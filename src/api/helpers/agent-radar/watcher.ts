import {
	AGENT_RADAR_STATUSES,
	type AgentRadarStatus,
	normalizeAgentRadarStatus,
} from "@/constants/agent-radar";
import { dbProjects } from "../../db/projects";
import { EXECUTION_WORKSPACE_LABEL } from "../execution-terminal";
import { getSystemSettings } from "../system-settings";
import {
	ensureKwTerminalServer,
	ensureOpencodeIntegration,
	kwTerminalAgentList,
	kwTerminalPaneList,
	kwTerminalPaneProcessInfo,
	kwTerminalPaneSession,
	kwTerminalSocketPath,
	kwTerminalTabList,
	kwTerminalWorkspaceList,
} from "../terminal/kw-terminal";
import { locateOpencodeSessionByDirectory } from "../opencode-db";
import { alertRadarTransition, shouldAlertTransition } from "./alerts";
import {
	KW_TERMINAL_LIFECYCLE_SUBSCRIPTIONS,
	type KwTerminalEvent,
	paneStatusSubscription,
} from "./events";
import { openKwTerminalEventStream, type KwTerminalEventStream } from "./socket";
import { resolveProcessTranscript } from "./transcript/process";
import {
	getRadarAgent,
	getRadarFocus,
	listRadarAgents,
	matchProjectByCwd,
	putRadarAgent,
	removeRadarPane,
	removeRadarWorkspace,
	renameRadarTab,
	renameRadarWorkspace,
	resetRadarAgents,
	setRadarFocus,
} from "./state";
import type { RadarFocus } from "@/api/schemas/terminal-workspace";

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const FOCUS_DEBOUNCE_MS = 40;

// Cada conexão bem-sucedida abre uma geração. Callback de socket derrubado chega depois do teardown,
// e sem essa marca ele mexeria no mapa já reconstruído pela geração seguinte.
let generation = 0;
let running = false;
let reconnectDelay = RECONNECT_MIN_MS;
let socketPath = "";
let lifecycle: KwTerminalEventStream | null = null;
const paneStreams = new Map<string, KwTerminalEventStream>();
let pendingFocus: RadarFocus | null = null;
let focusFlush: ReturnType<typeof setTimeout> | null = null;

function toRadarStatus(value: string): AgentRadarStatus {
	return normalizeAgentRadarStatus(
		AGENT_RADAR_STATUSES.find((status) => status === value) ?? "unknown",
	);
}

function clearFocusFlush() {
	if (focusFlush) {
		clearTimeout(focusFlush);
		focusFlush = null;
	}
	pendingFocus = null;
}

function flushFocus() {
	focusFlush = null;
	if (!pendingFocus) {
		return;
	}

	const next = pendingFocus;
	pendingFocus = null;
	void setRadarFocus(next);
}

function resolveFocusField(
	patched: string | null | undefined,
	currentValue: string | null,
	workspaceChanged: boolean,
) {
	if (patched !== undefined) {
		return patched;
	}

	if (workspaceChanged) {
		return null;
	}

	return currentValue;
}

// O daemon emite workspace → tab → pane em sequência a cada troca; o debounce junta o trio numa
// publicação só e evita o indicador "Na tela" piscar com tab/pane velhos no meio do caminho.
function scheduleFocusUpdate(patch: Partial<RadarFocus>) {
	const current = pendingFocus ?? getRadarFocus();
	const workspaceId = patch.workspaceId === undefined ? current.workspaceId : patch.workspaceId;
	const workspaceChanged = workspaceId !== current.workspaceId;

	pendingFocus = {
		workspaceId,
		tabId: resolveFocusField(patch.tabId, current.tabId, workspaceChanged),
		paneId: resolveFocusField(patch.paneId, current.paneId, workspaceChanged),
	};

	if (focusFlush) {
		clearTimeout(focusFlush);
	}

	focusFlush = setTimeout(flushFocus, FOCUS_DEBOUNCE_MS);
	focusFlush.unref();
}

function deriveFocus(params: {
	workspaces: { workspace_id: string; focused: boolean; active_tab_id: string }[];
	tabs: { tab_id: string; workspace_id: string; focused: boolean }[];
	panes: { pane_id: string; tab_id: string; workspace_id: string; focused: boolean }[];
}): RadarFocus {
	const workspace = params.workspaces.find(function (item) {
		return item.focused;
	});

	if (!workspace) {
		return { workspaceId: null, tabId: null, paneId: null };
	}

	const tab =
		params.tabs.find(function (item) {
			return item.workspace_id === workspace.workspace_id && item.focused;
		}) ??
		params.tabs.find(function (item) {
			return item.tab_id === workspace.active_tab_id;
		});

	const pane = params.panes.find(function (item) {
		return (
			item.workspace_id === workspace.workspace_id &&
			item.focused &&
			(!tab || item.tab_id === tab.tab_id)
		);
	});

	return {
		workspaceId: workspace.workspace_id,
		tabId: tab?.tab_id ?? workspace.active_tab_id,
		paneId: pane?.pane_id ?? null,
	};
}

function closePaneStream(paneId: string) {
	paneStreams.get(paneId)?.close();
	paneStreams.delete(paneId);
}

// O stream de status de um pane que cai sozinho não tem religamento próprio: sem isso o status
// daquele agent congelava até o próximo evento de lifecycle. Um resync relê os panes e o
// `watchPanes` do fim reabre o stream que falta; o debounce evita fechar e abrir em rajada.
let paneResync: ReturnType<typeof setTimeout> | null = null;

function schedulePaneResync(current: number) {
	if (!running || current !== generation) {
		return;
	}

	if (paneResync) {
		clearTimeout(paneResync);
	}

	paneResync = setTimeout(() => {
		paneResync = null;
		if (running && current === generation) {
			void syncRadar(current).catch((error) => {
				console.error("[Radar] Falha ao ressincronizar panes:", error);
			});
		}
	}, 500);
	paneResync.unref();
}

function teardown() {
	clearFocusFlush();
	if (paneResync) {
		clearTimeout(paneResync);
		paneResync = null;
	}
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
	void resetRadarAgents([], { captureSnapshot: false });

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
			onClose: () => {
				paneStreams.delete(paneId);
				schedulePaneResync(current);
			},
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

	const conversationalWorkspaces = workspaces.filter(
		(workspace) => workspace.label !== EXECUTION_WORKSPACE_LABEL,
	);
	const conversationalWorkspaceIds = new Set(
		conversationalWorkspaces.map((workspace) => workspace.workspace_id),
	);
	const conversationalPanes = panes.filter((pane) =>
		conversationalWorkspaceIds.has(pane.workspace_id),
	);
	const conversationalTabs = tabs.filter((tab) => conversationalWorkspaceIds.has(tab.workspace_id));
	const workspaceLabels = new Map(
		conversationalWorkspaces.map((workspace) => [workspace.workspace_id, workspace.label]),
	);
	const tabLabels = new Map(conversationalTabs.map((tab) => [tab.tab_id, tab.label]));
	// A tarefa que o agent anunciou só vem no `agent list`; o resto do cartão vem do `pane list`.
	const tasks = new Map(agents.map((agent) => [agent.pane_id, agent.session_task]));
	const recoveredTranscripts = new Map<string, { sessionId: string; path: string | null } | null>(
		await Promise.all(
			conversationalPanes.map(async (pane) => {
				const session = kwTerminalPaneSession(pane);
				if (!pane.agent || session.sessionPath) {
					return [pane.pane_id, null] as const;
				}

				// OpenCode sem reporte: a integração não carregou nesta instância. Instala para as
				// próximas e adota do banco a sessão mais recente daquele diretório, que é o único
				// sinal disponível — todas as conversas moram no mesmo arquivo de banco.
				if (pane.agent === "opencode" && !session.sessionId) {
					void ensureOpencodeIntegration();
					const adopted = locateOpencodeSessionByDirectory(pane.cwd);

					return [pane.pane_id, adopted ? { sessionId: adopted, path: null } : null] as const;
				}

				const processInfo = await kwTerminalPaneProcessInfo(pane.pane_id).catch(() => null);
				const transcript = processInfo
					? await resolveProcessTranscript({
							agent: pane.agent,
							processIds: processInfo.foreground_processes.map((process) => process.pid),
						})
					: null;

				return [pane.pane_id, transcript] as const;
			}),
		),
	);

	const nextAgents = conversationalPanes.flatMap((pane) => {
		if (!pane.agent) {
			return [];
		}

		const project = matchProjectByCwd(projects, pane.cwd);
		const known = getRadarAgent(pane.pane_id);
		const status = toRadarStatus(pane.agent_status);
		const task = tasks.get(pane.pane_id);
		const recoveredTranscript = recoveredTranscripts.get(pane.pane_id) ?? null;
		const reportedSession = kwTerminalPaneSession(pane);

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
				sessionId: reportedSession.sessionId ?? recoveredTranscript?.sessionId ?? null,
				sessionPath: reportedSession.sessionPath ?? recoveredTranscript?.path ?? null,
				taskId: task?.task_id ?? null,
				taskTitle: task?.title ?? null,
				changedAt: known?.status === status ? known.changedAt : Date.now(),
			},
		];
	});

	await resetRadarAgents(nextAgents, {
		focus: deriveFocus({
			workspaces: conversationalWorkspaces,
			tabs: conversationalTabs,
			panes: conversationalPanes,
		}),
		captureSnapshot: nextAgents.length > 0,
	});

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

	const status = normalizeAgentRadarStatus(event.data.agent_status);
	const next = {
		...known,
		status,
		agent: event.data.agent ?? known.agent,
		// Campo ausente é "o daemon não disse", não "virou vazio": zerar aqui apagava a atividade
		// que o cartão já mostrava a cada transição que vinha sem os campos opcionais.
		activity: event.data.activity ?? known.activity,
		title: event.data.title ?? known.title,
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

		return;
	}

	if (event.event === "workspace_focused") {
		scheduleFocusUpdate({ workspaceId: event.data.workspace_id });

		return;
	}

	if (event.event === "tab_focused") {
		scheduleFocusUpdate({
			workspaceId: event.data.workspace_id,
			tabId: event.data.tab_id,
		});

		return;
	}

	if (event.event === "pane_focused") {
		const known = getRadarAgent(event.data.pane_id);
		const patch: Partial<RadarFocus> = {
			workspaceId: event.data.workspace_id,
			paneId: event.data.pane_id,
		};

		if (known) {
			patch.tabId = known.tabId;
		}

		scheduleFocusUpdate(patch);
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
	await resetRadarAgents([], { captureSnapshot: false });
}
