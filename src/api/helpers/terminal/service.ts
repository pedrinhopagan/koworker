import { realpathSync } from "node:fs";

import { buildClaudeArgv } from "@/lib/claude-command";
import { buildCodexArgv } from "@/lib/codex-command";
import type { TerminalMultiplexer } from "@/constants/terminal";
import { PubSub, type TerminalEvent } from "../../pubsub";
import {
	buildNoneCommandArgv,
	hasTerminalCommand,
	type TerminalCommand,
	terminalCommandText,
} from "./command";
import { cliResumeArgv, cliResumeByIdArgv, cliStartArgv } from "./cli-argv";
import { type EmulatorProcess, spawnEmulator } from "./emulator";
import { focusTerminalWindow } from "./focus";
import {
	ensureKwTerminalServer,
	ensureWorkspaceByLabel,
	findTabByLabel,
	findWorkspaceByLabel,
	KW_TERMINAL_CLIENT_ARGV,
	type KwTerminalAgent,
	kwTerminalAgentFocus,
	kwTerminalAgentList,
	kwTerminalIntegrationInstall,
	type KwTerminalTab,
	kwTerminalClientAttached,
	kwTerminalPaneList,
	kwTerminalPaneRun,
	kwTerminalTabClose,
	kwTerminalTabCreate,
	kwTerminalTabFocus,
	kwTerminalTabList,
	type KwTerminalWorkspace,
	kwTerminalWorkspaceClose,
	kwTerminalWorkspaceFocus,
	kwTerminalWorkspaceList,
} from "./kw-terminal";
import {
	isInvocationWindow,
	NO_PROJECT_SESSION_NAME,
	sessionNameForProject,
	type TerminalTabTarget,
	terminalTabLabel,
} from "./names";
import {
	sessionHasTerminalAttached,
	tmuxKillSession,
	tmuxKillWindow,
	tmuxListWindows,
	tmuxNewSession,
	tmuxNewWindow,
	tmuxSelectWindow,
	tmuxSendKeys,
	tmuxSessionExists,
	tmuxWindowExists,
} from "./tmux";

// Emulador + multiplexador resolvidos pela fronteira (o router lê as settings de SO e passa como dado).
// O serviço não relê settings a cada chamada: quem é dono da config é a tabela `settings`.
export type TerminalConfig = {
	template: string;
	multiplexer: TerminalMultiplexer;
};

export type OpenTerminalResult = {
	sessionName: string;
	windowName: string;
	isNewSession: boolean;
	isNewWindow: boolean;
};

export type InvocationSessionInfo = {
	projectId: string;
	projectName: string;
	sessionName: string;
	windowCount: number;
};

type TrackedWindow = {
	taskId: string;
	windowName: string;
	// Só no modo `none`: o processo do emulador. O fechamento é detectado pelo `.exited` dele.
	process?: EmulatorProcess;
	// Só no modo kw-terminal: IDs voláteis da tab/pane kw-terminal. Repopulados por label após restart
	// do backend.
	paneId?: string;
	tabId?: string;
};

type TrackedSession = {
	projectId: string;
	projectName: string;
	sessionName: string;
	multiplexer: TerminalMultiplexer;
	windows: TrackedWindow[];
	// Só no modo kw-terminal: ID volátil do workspace kw-terminal. Repopulado por label após restart do
	// backend.
	workspaceId?: string;
};

// Estado em memória do serviço (o backend é um processo único e longo). Nos modos tmux/kw-terminal é
// um espelho do multiplexador, usado pra casar a window morta com o taskId da UI; no modo none é a
// única fonte (não há daemon externo). O monitor cuida de tmux/kw-terminal; o modo none usa `.exited`.
let sessions: TrackedSession[] = [];
let monitorTimer: ReturnType<typeof setInterval> | null = null;

function publish(event: TerminalEvent) {
	void PubSub.terminal.publish(event);
}

function findSession(projectId: string): TrackedSession | undefined {
	return sessions.find((session) => session.projectId === projectId);
}

type OpenParams = {
	config: TerminalConfig;
	projectId: string;
	projectName: string;
	workingDir: string;
	taskId: string;
	// O alvo, não o rótulo: o nome da window/tab sai daqui em `openTerminal` e só de lá, para os três
	// multiplexadores enxergarem o mesmo nome para o mesmo alvo.
	tab: TerminalTabTarget;
	command: TerminalCommand | undefined;
	forceNew: boolean;
	background: boolean;
	// Rota com força-nova mata a window homônima antes de recriá-la; tarefa reaproveita.
	killExistingOnForceNew: boolean;
};

type ResolvedOpenParams = OpenParams & { sessionName: string; windowName: string };

function openTerminal(params: OpenParams): Promise<OpenTerminalResult> {
	const resolved = {
		...params,
		sessionName: sessionNameFor(params.projectName),
		windowName: terminalTabLabel(params.tab),
	};

	if (params.config.multiplexer === "none") {
		return Promise.resolve(openNone(resolved));
	}

	if (params.config.multiplexer === "kw-terminal") {
		return openKwTerminal(resolved);
	}

	return openTmux(resolved);
}

// O grupo do kw-terminal é o projeto, sempre pelo nome cadastrado — nunca pela pasta onde o comando
// calhou de rodar. Sem projeto cobrindo o cwd, o grupo é o dos avulsos, e não `kw_<basename>`.
export function sessionNameFor(projectName: string | null): string {
	return projectName ? sessionNameForProject(projectName) : NO_PROJECT_SESSION_NAME;
}

// Ponto único de resolução do workspace de um projeto: quem abre terminal no kw-terminal passa por
// aqui, então o mesmo projeto cai sempre no mesmo grupo.
export function projectWorkspace(params: { projectName: string | null; mainRoute: string }) {
	return ensureWorkspaceByLabel({
		label: sessionNameFor(params.projectName),
		cwd: params.mainRoute,
	});
}

async function createProjectSessionTab(params: {
	projectName: string | null;
	mainRoute: string;
	cli: "claude" | "codex";
	tab: TerminalTabTarget;
	// A tab nasce na raiz do projeto por padrão; conversa retomada do histórico nasce na pasta onde
	// ela rodou, que pode ser um worktree ou uma subpasta.
	cwd?: string;
	command: TerminalCommand;
}) {
	await ensureKwTerminalServer();
	await kwTerminalIntegrationInstall(params.cli);
	const { workspace } = await projectWorkspace(params);
	const { tab, rootPane } = await kwTerminalTabCreate({
		workspaceId: workspace.workspace_id,
		cwd: params.cwd ?? params.mainRoute,
		label: terminalTabLabel(params.tab),
		focus: false,
	});

	await kwTerminalPaneRun(rootPane.pane_id, terminalCommandText(params.command));

	return {
		paneId: rootPane.pane_id,
		tabId: tab.tab_id,
		workspaceId: workspace.workspace_id,
	};
}

// O cliente TUI do kw-terminal é um só pra todos os projetos (todos os workspaces vivem no mesmo
// server), então a janela dele tem um rótulo fixo — vira o título "kw-terminal - Kowork" e casa no
// focus por WM.
const KW_TERMINAL_CLIENT_LABEL = "kw-terminal";

// Depois de focar no daemon, garante que há uma janela pra ver: sem cliente TUI aberto spawna o
// emulador do preset rodando o attach (título estável "kw-terminal - Kowork") e sobe a janela pelo
// WM. O foco WM é best-effort silencioso — casa título × classe do preset, outros emuladores só não
// focam.
export async function revealKwTerminalClient(params: {
	config: TerminalConfig;
	workingDir: string;
}): Promise<void> {
	if (!(await kwTerminalClientAttached())) {
		spawnAttach({
			config: params.config,
			title: `${KW_TERMINAL_CLIENT_LABEL} - Kowork`,
			commandArgv: [...KW_TERMINAL_CLIENT_ARGV],
			workingDir: params.workingDir,
		});
		await Bun.sleep(400);
	}

	await focusTerminalWindow(KW_TERMINAL_CLIENT_LABEL).catch(() => {});
}

// Modo kw-terminal: 1 tab = 1 window lógica (paridade tmux). Workspace = sessão do projeto (label
// `sessionName`), tab = tarefa/rota (label `windowName`), pane raiz da tab recebe o comando. IDs
// kw-terminal são voláteis; recuperamos workspace/tab por label pra sobreviver a restart do backend.
async function openKwTerminal(params: ResolvedOpenParams): Promise<OpenTerminalResult> {
	const { config, projectId, projectName, sessionName, windowName, workingDir, background } =
		params;

	await ensureKwTerminalServer();

	let isNewSession = false;
	let isNewWindow = false;

	const resolvedWorkspace = await projectWorkspace({ projectName, mainRoute: workingDir });
	const workspace = resolvedWorkspace.workspace;
	if (resolvedWorkspace.isNew) {
		isNewSession = true;
		publish({ eventType: "session_opened", projectId, sessionName });
	}

	const workspaceId = workspace.workspace_id;

	let tab = await findTabByLabel(workspaceId, windowName);

	if (tab && params.forceNew && params.killExistingOnForceNew) {
		await kwTerminalTabClose(tab.tab_id);
		tab = null;
	}

	let paneId: string;

	if (tab) {
		const panes = await kwTerminalPaneList({ workspaceId, tabId: tab.tab_id });
		paneId = panes[0]?.pane_id ?? "";
	} else {
		const created = await kwTerminalTabCreate({ workspaceId, cwd: workingDir, label: windowName });
		tab = created.tab;
		paneId = created.rootPane.pane_id;
		isNewWindow = true;
		if (!isNewSession) {
			publish({
				eventType: "window_opened",
				projectId,
				taskId: params.taskId,
				sessionName,
				windowName,
			});
		}
	}

	// Sessão recém-criada já traz uma tab raiz; a tab da tarefa é a primeira window da sessão, então
	// só emitimos `window_opened` aqui pra não duplicar quando `session_opened` já cobriu a abertura.
	if (isNewSession && isNewWindow) {
		publish({
			eventType: "window_opened",
			projectId,
			taskId: params.taskId,
			sessionName,
			windowName,
		});
	}

	if (params.command && hasTerminalCommand(params.command) && paneId) {
		await kwTerminalPaneRun(paneId, terminalCommandText(params.command));
	}

	// Foreground: primeiro foca no daemon (workspace + tab) pra o cliente renderizar já na tab certa;
	// depois traz a janela do cliente pra frente, igual ao caminho tmux.
	if (!background) {
		await kwTerminalWorkspaceFocus(workspaceId);
		if (tab) {
			await kwTerminalTabFocus(tab.tab_id);
		}

		await revealKwTerminalClient({ config, workingDir });
	}

	trackWindow({
		projectId,
		projectName,
		sessionName,
		multiplexer: "kw-terminal",
		taskId: params.taskId,
		windowName,
		workspaceId,
		tabId: tab?.tab_id,
		paneId,
	});
	startMonitor();

	return { sessionName, windowName, isNewSession, isNewWindow };
}

async function openTmux(params: ResolvedOpenParams): Promise<OpenTerminalResult> {
	const { config, projectId, projectName, sessionName, windowName, workingDir, background } =
		params;
	const title = `${projectName} - Kowork`;

	let isNewSession = false;
	let isNewWindow = false;

	const sessionExists = await tmuxSessionExists(sessionName);

	if (sessionExists) {
		const windowExists = await tmuxWindowExists(sessionName, windowName);

		if (params.forceNew || !windowExists) {
			if (windowExists && params.forceNew && params.killExistingOnForceNew) {
				await tmuxKillWindow(sessionName, windowName);
			}

			await tmuxNewWindow({ sessionName, windowName, workingDir });
			isNewWindow = true;
			publish({
				eventType: "window_opened",
				projectId,
				taskId: params.taskId,
				sessionName,
				windowName,
			});
		}

		if (!background) {
			if (!(await sessionHasTerminalAttached(sessionName))) {
				spawnAttach({
					config,
					title,
					commandArgv: ["tmux", "attach-session", "-t", sessionName],
					workingDir,
				});
				await Bun.sleep(300);
			}

			await focusTerminalWindow(projectName).catch(() => {});
			await tmuxSelectWindow(sessionName, windowName);
		}
	} else {
		await tmuxNewSession({ sessionName, workingDir, windowName });

		if (!background) {
			spawnAttach({
				config,
				title,
				commandArgv: ["tmux", "attach-session", "-t", sessionName],
				workingDir,
			});
			await Bun.sleep(500);
		}

		isNewSession = true;
		isNewWindow = true;
		publish({ eventType: "session_opened", projectId, sessionName });
		publish({
			eventType: "window_opened",
			projectId,
			taskId: params.taskId,
			sessionName,
			windowName,
		});
	}

	if (params.command && hasTerminalCommand(params.command)) {
		await tmuxSendKeys(sessionName, windowName, terminalCommandText(params.command));
	}

	trackWindow({
		projectId,
		projectName,
		sessionName,
		multiplexer: "tmux",
		taskId: params.taskId,
		windowName,
	});
	startMonitor();

	return { sessionName, windowName, isNewSession, isNewWindow };
}

// Spawna o emulador do preset atachado no multiplexador (tmux ou cliente kw-terminal). O
// `commandArgv` é o comando de attach de cada modo; o resto (template do preset, título, cwd) é comum.
function spawnAttach(params: {
	config: TerminalConfig;
	title: string;
	commandArgv: string[];
	workingDir: string;
}) {
	spawnEmulator({
		template: params.config.template,
		title: params.title,
		commandArgv: params.commandArgv,
		cwd: params.workingDir,
	});
}

function openNone(params: ResolvedOpenParams): OpenTerminalResult {
	const { projectId, projectName, sessionName, windowName, workingDir, command } = params;
	const shell = process.env.SHELL ?? "/bin/sh";

	const child = spawnEmulator({
		template: params.config.template,
		title: `${projectName} - Kowork`,
		commandArgv: buildNoneCommandArgv(command, shell),
		cwd: workingDir,
	});

	// Cada abertura é uma janela nova (não há multiplexador); rastreada pelo processo do emulador.
	const isNewSession = !findSession(projectId);
	const session = ensureNoneSession({ projectId, projectName, sessionName });
	const window: TrackedWindow = { taskId: params.taskId, windowName, process: child };
	session.windows.push(window);

	if (isNewSession) {
		publish({ eventType: "session_opened", projectId, sessionName });
	}
	publish({
		eventType: "window_opened",
		projectId,
		taskId: params.taskId,
		sessionName,
		windowName,
	});

	void child.exited.then(() => handleNoneWindowClosed(session, window));

	return { sessionName, windowName, isNewSession, isNewWindow: true };
}

function ensureNoneSession(params: {
	projectId: string;
	projectName: string;
	sessionName: string;
}): TrackedSession {
	const existing = findSession(params.projectId);
	if (existing) {
		return existing;
	}

	const created: TrackedSession = {
		projectId: params.projectId,
		projectName: params.projectName,
		sessionName: params.sessionName,
		multiplexer: "none",
		windows: [],
	};
	sessions.push(created);

	return created;
}

function handleNoneWindowClosed(session: TrackedSession, window: TrackedWindow) {
	const index = session.windows.indexOf(window);
	if (index === -1) {
		return;
	}

	session.windows.splice(index, 1);
	publish({
		eventType: "window_closed",
		projectId: session.projectId,
		taskId: window.taskId,
		sessionName: session.sessionName,
		windowName: window.windowName,
	});

	if (session.windows.length === 0) {
		sessions = sessions.filter((candidate) => candidate !== session);
		publish({
			eventType: "session_closed",
			projectId: session.projectId,
			sessionName: session.sessionName,
		});
	}
}

// Modos tmux/kw-terminal: dedup por taskId (a mesma tarefa reaproveita a window). No modo none o
// tracking é feito direto em `openNone` (uma window por processo), então esta função não é usada lá.
function trackWindow(params: {
	projectId: string;
	projectName: string;
	sessionName: string;
	multiplexer: TerminalMultiplexer;
	taskId: string;
	windowName: string;
	workspaceId?: string;
	tabId?: string;
	paneId?: string;
}) {
	const window: TrackedWindow = {
		taskId: params.taskId,
		windowName: params.windowName,
		...(params.tabId ? { tabId: params.tabId } : {}),
		...(params.paneId ? { paneId: params.paneId } : {}),
	};
	const existing = findSession(params.projectId);

	if (existing) {
		// Repopula o ID volátil do workspace kw-terminal após restart do backend (label é estável, ID
		// não).
		if (params.workspaceId) {
			existing.workspaceId = params.workspaceId;
		}
		const tracked = existing.windows.find((candidate) => candidate.taskId === params.taskId);
		if (tracked) {
			tracked.tabId = window.tabId;
			tracked.paneId = window.paneId;
		} else {
			existing.windows.push(window);
		}
		return;
	}

	sessions.push({
		projectId: params.projectId,
		projectName: params.projectName,
		sessionName: params.sessionName,
		multiplexer: params.multiplexer,
		windows: [window],
		...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
	});
}

// Monitor de fechamento externo (tmux + kw-terminal): a cada 3s confere se cada sessão/window
// rastreada ainda existe no multiplexador; o que o usuário fechou por fora vira
// `session_closed`/`window_closed`. O modo none não entra aqui (o `.exited` de cada processo já
// cobre). `.unref()` deixa o backend encerrar sem esperar o timer — o `Bun.serve` mantém o loop vivo
// em produção. Para sozinho quando não há mais nenhuma sessão tmux nem kw-terminal rastreada.
function startMonitor() {
	if (monitorTimer) {
		return;
	}

	monitorTimer = setInterval(() => {
		void tickMonitor();
	}, 3000);
	monitorTimer.unref?.();
}

async function tickMonitor() {
	await tickTmuxSessions();
	await tickKwTerminalSessions();

	const stillMonitored = sessions.some(
		(session) => session.multiplexer === "tmux" || session.multiplexer === "kw-terminal",
	);
	if (!stillMonitored && monitorTimer) {
		clearInterval(monitorTimer);
		monitorTimer = null;
	}
}

async function tickTmuxSessions() {
	for (const session of sessions.filter((candidate) => candidate.multiplexer === "tmux")) {
		if (!(await tmuxSessionExists(session.sessionName))) {
			pruneSession(session);
		}
	}
}

// Uma única leitura de `workspace list` por tick cobre todas as sessões kw-terminal (evita N
// chamadas). O workspace some → `session_closed`; senão, cada tab que sumiu vira `window_closed`. IDs
// voláteis são repopulados por label (o server kw-terminal sobrevive ao restart do backend, mas o ID
// em memória não).
async function tickKwTerminalSessions() {
	const kwTerminalSessions = sessions.filter(
		(candidate) => candidate.multiplexer === "kw-terminal",
	);
	if (kwTerminalSessions.length === 0) {
		return;
	}

	const workspaces = await kwTerminalWorkspaceList();

	for (const session of kwTerminalSessions) {
		const workspace = resolveKwTerminalWorkspace(session, workspaces);
		if (!workspace) {
			pruneSession(session);
			continue;
		}

		session.workspaceId = workspace.workspace_id;
		await pruneMissingKwTerminalWindows(session, workspace.workspace_id);
	}
}

function resolveKwTerminalWorkspace(
	session: TrackedSession,
	workspaces: KwTerminalWorkspace[],
): KwTerminalWorkspace | null {
	return (
		workspaces.find((workspace) => workspace.workspace_id === session.workspaceId) ??
		workspaces.find((workspace) => workspace.label === session.sessionName) ??
		null
	);
}

async function pruneMissingKwTerminalWindows(session: TrackedSession, workspaceId: string) {
	if (session.windows.length === 0) {
		return;
	}

	const tabs = await kwTerminalTabList(workspaceId);
	for (const window of session.windows.filter(
		(candidate) => !kwTerminalTabAlive(candidate, tabs),
	)) {
		pruneKwTerminalWindow(session, window);
	}
}

// Casa a window rastreada com uma tab viva por `tabId` (ID volátil) ou por `windowName` (label
// estável entre restarts), espelhando o lookup por label do resto do fluxo kw-terminal.
function kwTerminalTabAlive(window: TrackedWindow, tabs: KwTerminalTab[]): boolean {
	return tabs.some((tab) => tab.tab_id === window.tabId || tab.label === window.windowName);
}

// Remove a sessão do tracking e emite `session_closed`. O guard de presença evita double-publish
// quando um close via ORPC já removeu a sessão durante um `await` deste tick.
function pruneSession(session: TrackedSession) {
	if (!sessions.includes(session)) {
		return;
	}

	sessions = sessions.filter((candidate) => candidate !== session);
	publish({
		eventType: "session_closed",
		projectId: session.projectId,
		sessionName: session.sessionName,
	});
}

// Remove a window do tracking e emite `window_closed` com o taskId certo (a UI solta a chave por
// ele). Mesmo guard de presença do `pruneSession` contra double-publish concorrente com o ORPC.
function pruneKwTerminalWindow(session: TrackedSession, window: TrackedWindow) {
	if (!session.windows.includes(window)) {
		return;
	}

	session.windows = session.windows.filter((candidate) => candidate !== window);
	publish({
		eventType: "window_closed",
		projectId: session.projectId,
		taskId: window.taskId,
		sessionName: session.sessionName,
		windowName: window.windowName,
	});
}

// Casa a window morta com o estado em memória pra emitir `window_closed` com o taskId certo (a UI
// solta a chave por ele). Pós-restart a window existe no multiplexador mas não em memória: sem
// evento — e também não havia estado de UI pra ela.
function notifyInvocationWindowClosed(sessionName: string, windowName: string) {
	const session = sessions.find((candidate) => candidate.sessionName === sessionName);
	const window = session?.windows.find((candidate) => candidate.windowName === windowName);
	if (!session || !window) {
		return;
	}

	session.windows = session.windows.filter((candidate) => candidate !== window);
	publish({
		eventType: "window_closed",
		projectId: session.projectId,
		taskId: window.taskId,
		sessionName,
		windowName,
	});
}

// Labels das tabs kw-terminal do projeto. `workspaceId` em memória some no restart do backend, então
// caímos no lookup por label (`sessionName` é estável); sem workspace não há invocação a listar.
async function kwTerminalTabLabels(projectId: string, sessionName: string): Promise<string[]> {
	const session = findSession(projectId);
	const workspaceId =
		session?.workspaceId ?? (await findWorkspaceByLabel(sessionName))?.workspace_id;
	if (!workspaceId) {
		return [];
	}

	return (await kwTerminalTabList(workspaceId)).map((tab) => tab.label);
}

// Fecha cada tab de invocação kw-terminal por label e devolve quantas fecharam. 1 tab = 1 invocação;
// `workspaceId` em memória some no restart, então resolvemos o workspace por `sessionName` como
// fallback. Sem workspace não há o que fechar.
async function closeKwTerminalInvocationTabs(
	projectId: string,
	sessionName: string,
	windowNames: string[],
): Promise<number> {
	const session = findSession(projectId);
	const workspaceId =
		session?.workspaceId ?? (await findWorkspaceByLabel(sessionName))?.workspace_id;
	if (!workspaceId) {
		return 0;
	}

	let killed = 0;
	for (const windowName of windowNames) {
		const tab = await findTabByLabel(workspaceId, windowName);
		if (tab && (await kwTerminalTabClose(tab.tab_id))) {
			killed += 1;
			notifyInvocationWindowClosed(sessionName, windowName);
		}
	}

	return killed;
}

async function invocationWindowNames(params: {
	config: TerminalConfig;
	projectId: string;
	sessionName: string;
}): Promise<string[]> {
	let names: string[];
	if (params.config.multiplexer === "none") {
		names = findSession(params.projectId)?.windows.map((window) => window.windowName) ?? [];
	} else if (params.config.multiplexer === "kw-terminal") {
		names = await kwTerminalTabLabels(params.projectId, params.sessionName);
	} else {
		names = await tmuxListWindows(params.sessionName);
	}

	return names.filter(isInvocationWindow);
}

function invocationArgv(params: {
	prompt: string;
	cli?: "claude" | "codex";
	agent?: string;
	model?: string;
	effort?: string;
	permissionMode?: string;
	background?: boolean;
}): string[] {
	if (params.cli === "codex") {
		return buildCodexArgv({
			prompt: params.prompt,
			approvalMode: params.permissionMode ?? "bypass",
			headless: params.background ?? false,
			...(params.model ? { model: params.model } : {}),
			...(params.effort ? { effort: params.effort } : {}),
		});
	}

	return buildClaudeArgv({
		prompt: params.prompt,
		permissionMode: params.permissionMode ?? "bypass",
		headless: params.background ?? false,
		...(params.agent ? { agent: params.agent } : {}),
		...(params.model ? { model: params.model } : {}),
		...(params.effort ? { effort: params.effort } : {}),
	});
}

async function windowExists(params: {
	config: TerminalConfig;
	projectId: string;
	sessionName: string;
	windowName: string;
}): Promise<boolean> {
	if (params.config.multiplexer === "none") {
		return !!findSession(params.projectId)?.windows.some(
			(window) => window.windowName === params.windowName,
		);
	}

	if (params.config.multiplexer === "kw-terminal") {
		return (await kwTerminalTabLabels(params.projectId, params.sessionName)).includes(
			params.windowName,
		);
	}

	return await tmuxWindowExists(params.sessionName, params.windowName);
}

// Sessão do CLI ativo a focar: só os agents daquele binário abertos dentro do projeto (cwd exato
// antes de subpasta). Sem projeto não há a quem focar — o agent que o usuário deixou rodando em `~`
// não é a sessão do projeto, e focá-lo joga o kw-terminal num grupo que não é o da tela.
export function selectAgentForCli(params: {
	agents: KwTerminalAgent[];
	cli: string;
	mainRoute?: string;
}): KwTerminalAgent | null {
	const { mainRoute } = params;
	if (!mainRoute) {
		return null;
	}

	const matching = params.agents.filter((agent) => agent.agent === params.cli);

	const canonicalPath = (path: string) => {
		try {
			return realpathSync(path);
		} catch {
			return path;
		}
	};
	const canonicalRoute = canonicalPath(mainRoute);
	const inProject = matching.filter((agent) => {
		const cwd = canonicalPath(agent.cwd);
		return cwd === canonicalRoute || cwd.startsWith(`${canonicalRoute}/`);
	});

	return (
		inProject.find((agent) => canonicalPath(agent.cwd) === canonicalRoute) ?? inProject[0] ?? null
	);
}

export const Terminal = {
	startSession(params: {
		projectName: string;
		mainRoute: string;
		cli: "claude" | "codex";
		// Sessão livre da rota `/terminals` ou invocação de agent/skill: quem dispara diz o alvo, o
		// rótulo sai do motor de nomes.
		tab?: TerminalTabTarget;
		prompt?: string;
		model?: string;
		effort?: string;
		agent?: string;
		permissionMode?: "bypass" | "plan" | "acceptEdits" | "default";
		approvalMode?: "bypass" | "fullAuto" | "readOnly" | "default";
	}) {
		return createProjectSessionTab({
			projectName: params.projectName,
			mainRoute: params.mainRoute,
			cli: params.cli,
			tab: params.tab ?? { kind: "session" },
			command: { kind: "argv", argv: cliStartArgv(params) },
		});
	},

	resumeSession(params: { projectName: string; mainRoute: string; cli: "claude" | "codex" }) {
		return createProjectSessionTab({
			projectName: params.projectName,
			mainRoute: params.mainRoute,
			cli: params.cli,
			tab: { kind: "session", label: `Retomar ${params.cli}` },
			command: { kind: "argv", argv: cliResumeArgv(params.cli) },
		});
	},

	// Uma conversa antiga escolhida no histórico. A tab nasce na pasta onde a sessão rodou porque é
	// de lá que as duas CLIs enxergam o próprio histórico; o grupo continua sendo o do projeto que
	// cobre essa pasta, e o dos avulsos quando nenhum cobre.
	resumeSessionById(params: {
		projectName: string | null;
		mainRoute: string;
		cwd: string;
		cli: "claude" | "codex";
		sessionId: string;
	}) {
		return createProjectSessionTab({
			projectName: params.projectName,
			mainRoute: params.mainRoute,
			cwd: params.cwd,
			cli: params.cli,
			tab: { kind: "session", label: `Retomar ${params.cli}` },
			command: { kind: "argv", argv: cliResumeByIdArgv(params.cli, params.sessionId) },
		});
	},

	// Traz pra frente a sessão do CLI ativo do projeto já aberta no kw-terminal: foca o agent no
	// daemon, garante um cliente TUI visível e sobe a janela pelo WM. Sem agent daquele CLI dentro do
	// projeto (ou fora do modo kw-terminal) abre a tab `cli_<cli>` no grupo do projeto e sobe o CLI
	// nela; a tab que já existe é só focada, sem reexecutar o comando.
	//
	// O projeto é obrigatório: focar "a primeira sessão daquele CLI" levava o kw-terminal para o grupo
	// de uma pasta qualquer (um codex esquecido em `~` vira o grupo `pedro`), que nunca é o que a tela
	// está mostrando.
	async focusAgent(params: {
		config: TerminalConfig;
		cli: "claude" | "codex";
		projectId?: string;
		projectName?: string;
		mainRoute?: string;
	}) {
		const { projectId, projectName, mainRoute } = params;
		if (!projectId || !projectName || !mainRoute) {
			throw new Error(`Escolha o projeto antes de focar a sessão ${params.cli}`);
		}

		if (params.config.multiplexer === "kw-terminal") {
			await ensureKwTerminalServer();

			const agent = selectAgentForCli({
				agents: await kwTerminalAgentList(),
				cli: params.cli,
				mainRoute,
			});

			if (agent) {
				if (!(await kwTerminalAgentFocus(agent.terminal_id))) {
					throw new Error(`Falha ao focar a sessão ${params.cli} no kw-terminal`);
				}

				await revealKwTerminalClient({ config: params.config, workingDir: agent.cwd });

				return { agent: agent.agent, cwd: agent.cwd, status: agent.agent_status, opened: false };
			}
		}

		const tab: TerminalTabTarget = { kind: "cli", cli: params.cli };
		const alreadyOpen = await windowExists({
			config: params.config,
			projectId,
			sessionName: sessionNameFor(projectName),
			windowName: terminalTabLabel(tab),
		});

		await openTerminal({
			config: params.config,
			projectId,
			projectName,
			workingDir: mainRoute,
			taskId: terminalTabLabel(tab),
			tab,
			command: alreadyOpen ? undefined : { kind: "argv", argv: cliStartArgv({ cli: params.cli }) },
			forceNew: false,
			background: false,
			killExistingOnForceNew: false,
		});

		return { agent: params.cli, cwd: mainRoute, status: "starting", opened: !alreadyOpen };
	},

	openForTask(params: {
		config: TerminalConfig;
		projectId: string;
		projectName: string;
		mainRoute: string;
		taskId: string;
		taskTitle: string;
		prompt?: string;
		cli?: "claude" | "codex";
		agent?: string;
		model?: string;
		effort?: string;
		permissionMode?: string;
		forceNew?: boolean;
		background?: boolean;
	}): Promise<OpenTerminalResult> {
		const command: TerminalCommand | undefined = params.prompt
			? { kind: "argv", argv: invocationArgv({ ...params, prompt: params.prompt }) }
			: undefined;

		return openTerminal({
			config: params.config,
			projectId: params.projectId,
			projectName: params.projectName,
			workingDir: params.mainRoute,
			taskId: params.taskId,
			tab: { kind: "task", taskId: params.taskId, title: params.taskTitle },
			command,
			forceNew: params.forceNew ?? false,
			background: params.background ?? false,
			killExistingOnForceNew: false,
		});
	},

	openForRoute(params: {
		config: TerminalConfig;
		projectId: string;
		projectName: string;
		routeId: string;
		routeName: string;
		routePath: string;
		command?: string;
		forceNew?: boolean;
		background?: boolean;
	}): Promise<OpenTerminalResult> {
		return openTerminal({
			config: params.config,
			projectId: params.projectId,
			projectName: params.projectName,
			workingDir: params.routePath,
			taskId: params.routeId,
			tab: { kind: "route", name: params.routeName },
			command: params.command ? { kind: "script", script: params.command } : undefined,
			forceNew: params.forceNew ?? false,
			background: params.background ?? false,
			killExistingOnForceNew: true,
		});
	},

	async closeProjectSession(params: {
		config: TerminalConfig;
		projectId: string;
		projectName: string;
	}): Promise<void> {
		const sessionName = sessionNameFor(params.projectName);

		if (params.config.multiplexer === "none") {
			// O `.exited` de cada processo dispara handleNoneWindowClosed de forma assíncrona (não durante
			// este loop), então iterar o array vivo é seguro — nada o muta aqui.
			for (const window of findSession(params.projectId)?.windows ?? []) {
				window.process?.kill();
			}
			return;
		}

		if (params.config.multiplexer === "kw-terminal") {
			// Fecha o workspace inteiro. O `workspaceId` em memória some no restart do backend, então
			// caímos no lookup por label (`sessionName` é estável) pra ainda achar o workspace.
			const tracked = findSession(params.projectId);
			const workspaceId =
				tracked?.workspaceId ?? (await findWorkspaceByLabel(sessionName))?.workspace_id;

			if (workspaceId && !(await kwTerminalWorkspaceClose(workspaceId))) {
				throw new Error("Falha ao encerrar workspace kw-terminal");
			}

			for (const window of tracked?.windows ?? []) {
				publish({
					eventType: "window_closed",
					projectId: params.projectId,
					taskId: window.taskId,
					sessionName,
					windowName: window.windowName,
				});
			}

			sessions = sessions.filter((session) => session.projectId !== params.projectId);
			publish({ eventType: "session_closed", projectId: params.projectId, sessionName });
			return;
		}

		if (await tmuxSessionExists(sessionName)) {
			if (!(await tmuxKillSession(sessionName))) {
				throw new Error("Falha ao encerrar sessão tmux");
			}

			sessions = sessions.filter((session) => session.projectId !== params.projectId);
			publish({ eventType: "session_closed", projectId: params.projectId, sessionName });
		}
	},

	async closeTaskWindow(params: {
		config: TerminalConfig;
		projectId: string;
		projectName: string;
		taskId: string;
		taskTitle: string;
	}): Promise<void> {
		const sessionName = sessionNameFor(params.projectName);
		const windowName = terminalTabLabel({
			kind: "task",
			taskId: params.taskId,
			title: params.taskTitle,
		});

		if (params.config.multiplexer === "none") {
			const window = findSession(params.projectId)?.windows.find(
				(candidate) => candidate.windowName === windowName,
			);
			window?.process?.kill();
			return;
		}

		if (params.config.multiplexer === "kw-terminal") {
			// 1 tab = 1 window lógica: fechamos a tab, não o pane. `tabId` em memória some no restart, então
			// resolvemos por label (workspace por `sessionName`, tab por `windowName`) como fallback.
			const session = findSession(params.projectId);
			const tracked = session?.windows.find((candidate) => candidate.taskId === params.taskId);
			let tabId = tracked?.tabId;

			if (!tabId) {
				const workspaceId =
					session?.workspaceId ?? (await findWorkspaceByLabel(sessionName))?.workspace_id;
				if (workspaceId) {
					tabId = (await findTabByLabel(workspaceId, windowName))?.tab_id;
				}
			}

			if (tabId && !(await kwTerminalTabClose(tabId))) {
				throw new Error("Falha ao fechar tab kw-terminal");
			}

			if (session) {
				session.windows = session.windows.filter((window) => window.taskId !== params.taskId);
			}
			publish({
				eventType: "window_closed",
				projectId: params.projectId,
				taskId: params.taskId,
				sessionName,
				windowName,
			});
			return;
		}

		if (
			(await tmuxSessionExists(sessionName)) &&
			(await tmuxWindowExists(sessionName, windowName))
		) {
			if (!(await tmuxKillWindow(sessionName, windowName))) {
				throw new Error("Falha ao fechar window tmux");
			}

			const session = findSession(params.projectId);
			if (session) {
				session.windows = session.windows.filter((window) => window.taskId !== params.taskId);
			}
			publish({
				eventType: "window_closed",
				projectId: params.projectId,
				taskId: params.taskId,
				sessionName,
				windowName,
			});
		}
	},

	// Lista os projetos informados que têm invocações de agent/skill abertas, com a contagem. Projetos
	// sem invocação aberta não entram (nada a fechar). As consultas por projeto são independentes.
	async listInvocationSessions(params: {
		config: TerminalConfig;
		projects: { id: string; name: string }[];
	}): Promise<InvocationSessionInfo[]> {
		const infos = await Promise.all(
			params.projects.map(async (project) => {
				const sessionName = sessionNameFor(project.name);
				const windowCount = (
					await invocationWindowNames({ config: params.config, projectId: project.id, sessionName })
				).length;

				return { projectId: project.id, projectName: project.name, sessionName, windowCount };
			}),
		);

		return infos.filter((info) => info.windowCount > 0);
	},

	// Fecha só as windows de invocação dos projetos selecionados, preservando terminal/tarefas/rotas.
	// No tmux/kw-terminal, sessões que ficam sem window podem ser encerradas pelo multiplexador e o
	// monitor emite `session_closed`. Retorna quantas windows foram fechadas.
	async closeInvocationSessions(params: {
		config: TerminalConfig;
		projects: { id: string; name: string }[];
	}): Promise<number> {
		let killed = 0;

		for (const project of params.projects) {
			const sessionName = sessionNameFor(project.name);
			const windowNames = await invocationWindowNames({
				config: params.config,
				projectId: project.id,
				sessionName,
			});

			if (params.config.multiplexer === "none") {
				const session = findSession(project.id);
				for (const windowName of windowNames) {
					const window = session?.windows.find((candidate) => candidate.windowName === windowName);
					if (window?.process) {
						window.process.kill();
						killed += 1;
					}
				}
				continue;
			}

			if (params.config.multiplexer === "kw-terminal") {
				killed += await closeKwTerminalInvocationTabs(project.id, sessionName, windowNames);
				continue;
			}

			for (const windowName of windowNames) {
				if (await tmuxKillWindow(sessionName, windowName)) {
					killed += 1;
					notifyInvocationWindowClosed(sessionName, windowName);
				}
			}
		}

		return killed;
	},
};
