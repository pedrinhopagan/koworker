import { AGENT_RADAR_STATUSES, type AgentRadarStatus } from "@/constants/agent-radar";
import { dbProjects } from "../../db/projects";
import { getSystemSettings } from "../system-settings";
import {
	ensureKwTerminalServer,
	kwTerminalAgentList,
	kwTerminalPaneList,
	kwTerminalSocketPath,
	kwTerminalTabList,
	kwTerminalWorkspaceList,
} from "../terminal/kw-terminal";
import { alertRadarTransition, shouldAlertTransition } from "./alerts";
import {
	KW_TERMINAL_LIFECYCLE_SUBSCRIPTIONS,
	type KwTerminalEvent,
	paneStatusSubscription,
} from "./events";
import { openKwTerminalEventStream, type KwTerminalEventStream } from "./socket";
import {
	getRadarAgent,
	listRadarAgents,
	matchProjectByCwd,
	putRadarAgent,
	removeRadarPane,
	removeRadarWorkspace,
	renameRadarTab,
	renameRadarWorkspace,
	resetRadarAgents,
} from "./state";

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

// Cada conexão bem-sucedida abre uma geração. Callback de socket derrubado chega depois do teardown,
// e sem essa marca ele mexeria no mapa já reconstruído pela geração seguinte.
let generation = 0;
let running = false;
let reconnectDelay = RECONNECT_MIN_MS;
let socketPath = "";
let lifecycle: KwTerminalEventStream | null = null;
const paneStreams = new Map<string, KwTerminalEventStream>();

function toRadarStatus(value: string): AgentRadarStatus {
	return AGENT_RADAR_STATUSES.find((status) => status === value) ?? "unknown";
}

function closePaneStream(paneId: string) {
	paneStreams.get(paneId)?.close();
	paneStreams.delete(paneId);
}

function teardown() {
	lifecycle?.close();
	lifecycle = null;

	for (const paneId of paneStreams.keys()) {
		closePaneStream(paneId);
	}
}

// Queda do daemon derruba toda conexão e invalida todo `pane_id`, então a perda é tratada como perda
// total: o mapa esvazia e a próxima conexão o reconstrói relistando os panes.
function scheduleReconnect(current: number) {
	if (!running || current !== generation) {
		return;
	}

	teardown();
	void resetRadarAgents([]);

	const delay = reconnectDelay;
	reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);

	setTimeout(() => {
		if (running) {
			void connect();
		}
	}, delay).unref();
}

async function watchPanes(current: number) {
	const panes = new Set(listRadarAgents().map((agent) => agent.paneId));

	for (const paneId of paneStreams.keys()) {
		if (!panes.has(paneId)) {
			closePaneStream(paneId);
		}
	}

	for (const paneId of panes) {
		if (paneStreams.has(paneId)) {
			continue;
		}

		const stream = await openKwTerminalEventStream({
			socketPath,
			subscriptions: paneStatusSubscription(paneId),
			onEvent: (event) => void handleStatusEvent(event, current),
			onClose: () => paneStreams.delete(paneId),
		});

		if (current !== generation) {
			stream.close();

			return;
		}

		paneStreams.set(paneId, stream);
	}
}

// Reconstrói o mapa inteiro a partir do daemon. A leitura é `pane list` e não `agent list` porque só
// ela carrega `activity` e `title`: a assinatura de status sem filtro não emite nada na entrada, e
// sem isso o cartão nasceria mudo até a primeira transição.
async function syncRadar(current: number) {
	const [panes, agents, workspaces, projects] = await Promise.all([
		kwTerminalPaneList({}),
		kwTerminalAgentList(),
		kwTerminalWorkspaceList(),
		dbProjects.getAll(),
	]);
	const tabs = (
		await Promise.all(workspaces.map((workspace) => kwTerminalTabList(workspace.workspace_id)))
	).flat();

	if (current !== generation) {
		return;
	}

	const workspaceLabels = new Map(
		workspaces.map((workspace) => [workspace.workspace_id, workspace.label]),
	);
	const tabLabels = new Map(tabs.map((tab) => [tab.tab_id, tab.label]));
	// A tarefa que o agent anunciou só vem no `agent list`; o resto do cartão vem do `pane list`.
	const tasks = new Map(agents.map((agent) => [agent.pane_id, agent.session_task]));

	await resetRadarAgents(
		panes.flatMap((pane) => {
			if (!pane.agent) {
				return [];
			}

			const project = matchProjectByCwd(projects, pane.cwd);
			const known = getRadarAgent(pane.pane_id);
			const status = toRadarStatus(pane.agent_status);
			const task = tasks.get(pane.pane_id);

			return [
				{
					paneId: pane.pane_id,
					workspaceId: pane.workspace_id,
					workspaceLabel: workspaceLabels.get(pane.workspace_id) ?? pane.workspace_id,
					tabId: pane.tab_id,
					tabLabel: tabLabels.get(pane.tab_id) ?? pane.tab_id,
					agent: pane.agent,
					status,
					activity: pane.activity ?? null,
					title: pane.title ?? null,
					cwd: pane.cwd,
					projectId: project?.id ?? null,
					projectName: project?.name ?? null,
					sessionId: pane.agent_session_id ?? null,
					sessionPath: pane.agent_session_path ?? null,
					taskId: task?.task_id ?? null,
					taskTitle: task?.title ?? null,
					changedAt: known?.status === status ? known.changedAt : Date.now(),
				},
			];
		}),
	);

	await watchPanes(current);
}

async function handleStatusEvent(event: KwTerminalEvent, current: number) {
	if (current !== generation || event.event !== "pane.agent_status_changed") {
		return;
	}

	const known = getRadarAgent(event.data.pane_id);

	if (!known) {
		return;
	}

	const status = event.data.agent_status;
	const next = {
		...known,
		status,
		agent: event.data.agent ?? known.agent,
		activity: event.data.activity ?? null,
		title: event.data.title ?? null,
		changedAt: status === known.status ? known.changedAt : Date.now(),
	};

	await putRadarAgent(next);

	if (shouldAlertTransition(known.status, status)) {
		await alertRadarTransition(next);
	}
}

async function handleLifecycleEvent(event: KwTerminalEvent, current: number) {
	if (current !== generation) {
		return;
	}

	if (event.event === "pane_agent_detected") {
		await syncRadar(current);

		return;
	}

	if (event.event === "pane_exited" || event.event === "pane_closed") {
		closePaneStream(event.data.pane_id);
		await removeRadarPane(event.data.pane_id);

		return;
	}

	if (event.event === "workspace_closed") {
		for (const agent of listRadarAgents()) {
			if (agent.workspaceId === event.data.workspace_id) {
				closePaneStream(agent.paneId);
			}
		}

		await removeRadarWorkspace(event.data.workspace_id);

		return;
	}

	if (event.event === "workspace_renamed") {
		await renameRadarWorkspace(event.data.workspace_id, event.data.label);

		return;
	}

	if (event.event === "tab_renamed") {
		await renameRadarTab(event.data.tab_id, event.data.label);
	}
}

async function connect() {
	const current = ++generation;

	try {
		await ensureKwTerminalServer();
		socketPath = await kwTerminalSocketPath();

		lifecycle = await openKwTerminalEventStream({
			socketPath,
			subscriptions: KW_TERMINAL_LIFECYCLE_SUBSCRIPTIONS,
			onEvent: (event) => void handleLifecycleEvent(event, current),
			onClose: () => scheduleReconnect(current),
		});

		await syncRadar(current);
		reconnectDelay = RECONNECT_MIN_MS;
	} catch (error) {
		console.error("[Radar] Falha ao conectar no kw-terminal:", error);
		scheduleReconnect(current);
	}
}

// A central só existe onde existe kw-terminal: nos modos tmux e none não há daemon de onde ler
// status, e subir um só pra observar seria criar terminal que o usuário não pediu.
export async function startAgentRadar() {
	if (running || (await getSystemSettings()).terminalMultiplexer !== "kw-terminal") {
		return;
	}

	running = true;
	await connect();
}

export async function stopAgentRadar() {
	if (!running) {
		return;
	}

	running = false;
	generation += 1;
	teardown();
	await resetRadarAgents([]);
}
