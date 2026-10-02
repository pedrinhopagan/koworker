import { realpathSync } from "node:fs";

import { buildClaudeArgv } from "@/lib/claude-command";
import { buildCodexArgv } from "@/lib/codex-command";
import type { WorkingCli } from "@/constants/invoke";
import { PubSub, type TerminalEvent } from "../../pubsub";
import { spawnEnv } from "../spawn";
import { hasTerminalCommand, type TerminalCommand, terminalCommandText } from "./command";
import {
	cliResumeArgv,
	cliResumeByIdArgv,
	type CliResumeOptions,
	type ResumableCli,
	cliStartArgv,
	cliStartWithFullAccessArgv,
} from "./cli-argv";
import { focusTerminalWindow } from "./focus";
import {
	ensureKwTerminalServer,
	ensureWorkspaceByLabel,
	findTabByLabel,
	findWorkspaceByLabel,
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
	kwTerminalWindowArgv,
} from "./kw-terminal";
import {
	isInvocationWindow,
	NO_PROJECT_SESSION_NAME,
	sessionNameForProject,
	type TerminalTabTarget,
	terminalTabLabel,
} from "./names";
export type OpenTerminalResult = {
	sessionName: string;
	windowName: string;
	isNewSession: boolean;
	isNewWindow: boolean;
};

type TrackedWindow = {
	taskId: string;
	windowName: string;
	// IDs voláteis da tab/pane kw-terminal. Repopulados por label após restart do backend.
	paneId?: string;
	tabId?: string;
};

type TrackedSession = {
	projectId: string;
	projectName: string;
	sessionName: string;
	windows: TrackedWindow[];
	// ID volátil do workspace kw-terminal. Repopulado por label após restart do backend.
	workspaceId?: string;
};

// Estado em memória do serviço (o backend é um processo único e longo): espelho do kw-terminal, usado
// pra casar a tab morta com o taskId da UI.
let sessions: TrackedSession[] = [];
let monitorTimer: ReturnType<typeof setInterval> | null = null;

function publish(event: TerminalEvent) {
	void PubSub.terminal.publish(event);
}

function findSession(projectId: string): TrackedSession | undefined {
	return sessions.find((session) => session.projectId === projectId);
}

type OpenParams = {
	projectId: string;
	projectName: string;
	workingDir: string;
	taskId: string;
	// O alvo, não o rótulo: o nome da tab sai daqui em `openTerminal` e só de lá.
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

	return openKwTerminal(resolved);
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
	cli: ResumableCli;
	tab: TerminalTabTarget;
	// A tab nasce na raiz do projeto por padrão; conversa retomada do histórico nasce na pasta onde
	// ela rodou, que pode ser um worktree ou uma subpasta.
	cwd?: string;
	command: TerminalCommand;
	// Retomada reutiliza a tab de mesmo rótulo: clicar de novo não pode empilhar tabs iguais nem
	// rodar `--resume` duas vezes no mesmo histórico, que é corrida entre dois processos.
	reuseExisting?: boolean;
}) {
	await ensureKwTerminalServer();
	// O opencode 2 não tem integração para instalar: quem reporta estado e sessão dele é o próprio
	// kw-terminal, lendo o serviço local do opencode.
	if (params.cli !== "opencode2") {
		await kwTerminalIntegrationInstall(params.cli);
	}
	const { workspace } = await projectWorkspace(params);

	if (params.reuseExisting) {
		const label = terminalTabLabel(params.tab);
		const existing = await findTabByLabel(workspace.workspace_id, label);
		const rootPane = existing
			? (
					await kwTerminalPaneList({
						workspaceId: workspace.workspace_id,
						tabId: existing.tab_id,
					})
				)[0]
			: undefined;

		if (existing && rootPane) {
			if (!rootPane.agent) {
				await kwTerminalPaneRun(rootPane.pane_id, terminalCommandText(params.command));
			}

			return {
				paneId: rootPane.pane_id,
				tabId: existing.tab_id,
				workspaceId: workspace.workspace_id,
			};
		}
	}

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

// Depois de focar no daemon, garante que há uma janela pra ver: sem cliente TUI aberto abre a janela
// do kw-terminal (título estável "kw-terminal - Kowork") e sobe ela pelo WM. O foco WM é best-effort
// silencioso.
export async function revealKwTerminalClient(params: { workingDir: string }): Promise<void> {
	if (!(await kwTerminalClientAttached())) {
		const argv = kwTerminalWindowArgv(`${KW_TERMINAL_CLIENT_LABEL} - Kowork`);
		if (!argv) {
			throw new Error("Terminal externo indisponível: o kw-terminal só roda no Linux e no macOS");
		}
		try {
			Bun.spawn(argv, {
				cwd: params.workingDir,
				stdout: "ignore",
				stderr: "ignore",
				stdin: "ignore",
				env: spawnEnv(),
			});
		} catch {
			throw new Error(
				`Não foi possível abrir a janela do kw-terminal: "${argv[0]}" não encontrado`,
			);
		}
		await Bun.sleep(400);
	}

	await focusTerminalWindow(KW_TERMINAL_CLIENT_LABEL).catch(() => {});
}

// Workspace = sessão do projeto (label `sessionName`), tab = tarefa/rota (label `windowName`), pane raiz
// da tab recebe o comando. IDs kw-terminal são voláteis; recuperamos workspace/tab por label pra
// sobreviver a restart do backend.
async function openKwTerminal(params: ResolvedOpenParams): Promise<OpenTerminalResult> {
	const { projectId, projectName, sessionName, windowName, workingDir, background } = params;

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
	// depois traz a janela do cliente pra frente.
	if (!background) {
		await kwTerminalWorkspaceFocus(workspaceId);
		if (tab) {
			await kwTerminalTabFocus(tab.tab_id);
		}

		await revealKwTerminalClient({ workingDir });
	}

	trackWindow({
		projectId,
		projectName,
		sessionName,
		taskId: params.taskId,
		windowName,
		workspaceId,
		tabId: tab?.tab_id,
		paneId,
	});
	startMonitor();

	return { sessionName, windowName, isNewSession, isNewWindow };
}

// Dedup por taskId: a mesma tarefa reaproveita a tab.
function trackWindow(params: {
	projectId: string;
	projectName: string;
	sessionName: string;
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
		windows: [window],
		...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
	});
}

// Monitor de fechamento externo: a cada 3s confere se cada workspace/tab rastreado ainda existe no
// kw-terminal; o que o usuário fechou por fora vira `session_closed`/`window_closed`. `.unref()` deixa
// o backend encerrar sem esperar o timer: o `Bun.serve` mantém o loop vivo em produção. Para sozinho
// quando não há mais nenhuma sessão rastreada.
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
	await tickKwTerminalSessions();

	if (sessions.length === 0 && monitorTimer) {
		clearInterval(monitorTimer);
		monitorTimer = null;
	}
}

// Uma única leitura de `workspace list` por tick cobre todas as sessões kw-terminal (evita N
// chamadas). O workspace some → `session_closed`; senão, cada tab que sumiu vira `window_closed`. IDs
// voláteis são repopulados por label (o server kw-terminal sobrevive ao restart do backend, mas o ID
// em memória não).
async function tickKwTerminalSessions() {
	if (sessions.length === 0) {
		return;
	}

	const workspaces = await kwTerminalWorkspaceList();

	for (const session of sessions) {
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

async function closeKwTerminalProject(params: { projectId: string; sessionName: string }) {
	const tracked = findSession(params.projectId);
	const workspaceId =
		tracked?.workspaceId ?? (await findWorkspaceByLabel(params.sessionName))?.workspace_id;

	if (workspaceId && !(await kwTerminalWorkspaceClose(workspaceId))) {
		throw new Error("Falha ao encerrar workspace kw-terminal");
	}

	for (const window of tracked?.windows ?? []) {
		publish({
			eventType: "window_closed",
			projectId: params.projectId,
			taskId: window.taskId,
			sessionName: params.sessionName,
			windowName: window.windowName,
		});
	}

	sessions = sessions.filter((session) => session.projectId !== params.projectId);
	publish({
		eventType: "session_closed",
		projectId: params.projectId,
		sessionName: params.sessionName,
	});
}

async function closeKwTerminalWindow(params: {
	projectId: string;
	sessionName: string;
	taskId: string;
	windowName: string;
}) {
	const session = findSession(params.projectId);
	const tracked = session?.windows.find((candidate) => candidate.taskId === params.taskId);
	let tabId = tracked?.tabId;

	if (!tabId) {
		const workspaceId =
			session?.workspaceId ?? (await findWorkspaceByLabel(params.sessionName))?.workspace_id;
		if (workspaceId) {
			tabId = (await findTabByLabel(workspaceId, params.windowName))?.tab_id;
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
		sessionName: params.sessionName,
		windowName: params.windowName,
	});
}

async function focusKwTerminalAgent(params: { cli: WorkingCli; mainRoute: string }) {
	await ensureKwTerminalServer();

	const agent = selectAgentForCli({
		agents: await kwTerminalAgentList(),
		cli: params.cli,
		mainRoute: params.mainRoute,
	});
	if (!agent) {
		return null;
	}

	if (!(await kwTerminalAgentFocus(agent.terminal_id))) {
		throw new Error(`Falha ao focar a sessão ${params.cli} no kw-terminal`);
	}

	await revealKwTerminalClient({ workingDir: agent.cwd });

	return agent;
}

async function invocationWindowNames(projectId: string, sessionName: string): Promise<string[]> {
	return (await kwTerminalTabLabels(projectId, sessionName)).filter(isInvocationWindow);
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
	projectId: string;
	sessionName: string;
	windowName: string;
}): Promise<boolean> {
	return (await kwTerminalTabLabels(params.projectId, params.sessionName)).includes(
		params.windowName,
	);
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
		projectName: string | null;
		mainRoute: string;
		cli: "claude" | "codex";
		// Sessão livre da rota `/shells` ou invocação de agent/skill: quem dispara diz o alvo, o
		// rótulo sai do motor de nomes.
		tab?: TerminalTabTarget;
		prompt?: string;
		model?: string;
		effort?: string;
		agent?: string;
		permissionMode?: "bypass" | "plan" | "acceptEdits" | "default";
		approvalMode?: "bypass" | "fullAuto" | "readOnly" | "default";
		// Conversa que continua outra (troca de CLI) nasce na pasta onde a anterior rodava.
		cwd?: string;
	}) {
		return createProjectSessionTab({
			projectName: params.projectName,
			mainRoute: params.mainRoute,
			...(params.cwd ? { cwd: params.cwd } : {}),
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
			reuseExisting: true,
		});
	},

	// Uma conversa antiga escolhida no histórico. A tab nasce na pasta onde a sessão rodou porque é
	// de lá que as duas CLIs enxergam o próprio histórico; o grupo continua sendo o do projeto que
	// cobre essa pasta, e o dos avulsos quando nenhum cobre.
	resumeSessionById(params: {
		projectName: string | null;
		mainRoute: string;
		cwd: string;
		cli: ResumableCli;
		sessionId: string;
		// Troca de modelo de uma sessão viva: a mesma conversa reabre com outro modelo/esforço e já
		// recebe a mensagem. A tab do pane recém-fechado tem que nascer de novo, nunca ser reusada.
		options?: CliResumeOptions & { tab?: TerminalTabTarget };
	}) {
		const reopening = !!params.options;

		return createProjectSessionTab({
			projectName: params.projectName,
			mainRoute: params.mainRoute,
			cwd: params.cwd,
			cli: params.cli,
			// O id no rótulo é o que permite reutilizar a tab sem trocar uma conversa pela outra:
			// retomadas diferentes da mesma CLI precisam de tabs diferentes.
			tab: params.options?.tab ?? {
				kind: "session",
				label: `Retomar ${params.cli} · ${params.sessionId.slice(0, 8)}`,
			},
			command: {
				kind: "argv",
				argv: cliResumeByIdArgv(params.cli, params.sessionId, params.options ?? {}),
			},
			reuseExisting: !reopening,
		});
	},

	// Traz pra frente a sessão do CLI ativo do projeto já aberta no kw-terminal: foca o agent no
	// daemon, garante um cliente TUI visível e sobe a janela pelo WM. Sem agent daquele CLI dentro do
	// projeto abre a tab `cli_<cli>` no grupo do projeto e sobe o CLI nela; a tab que já existe é só
	// focada, sem reexecutar o comando.
	//
	// O projeto é obrigatório: focar "a primeira sessão daquele CLI" levava o kw-terminal para o grupo
	// de uma pasta qualquer (um codex esquecido em `~` vira o grupo `pedro`), que nunca é o que a tela
	// está mostrando.
	async focusAgent(params: {
		cli: WorkingCli;
		projectId?: string;
		projectName?: string;
		mainRoute?: string;
	}) {
		const { projectId, projectName, mainRoute } = params;
		if (!projectId || !projectName || !mainRoute) {
			throw new Error(`Escolha o projeto antes de focar a sessão ${params.cli}`);
		}

		const agent = await focusKwTerminalAgent({ cli: params.cli, mainRoute });
		if (agent) {
			return { agent: agent.agent, cwd: agent.cwd, status: agent.agent_status, opened: false };
		}

		const tab: TerminalTabTarget = { kind: "cli", cli: params.cli };
		const alreadyOpen = await windowExists({
			projectId,
			sessionName: sessionNameFor(projectName),
			windowName: terminalTabLabel(tab),
		});

		await openTerminal({
			projectId,
			projectName,
			workingDir: mainRoute,
			taskId: terminalTabLabel(tab),
			tab,
			command: alreadyOpen
				? undefined
				: { kind: "argv", argv: cliStartWithFullAccessArgv(params.cli) },
			forceNew: false,
			background: false,
			killExistingOnForceNew: false,
		});

		return { agent: params.cli, cwd: mainRoute, status: "starting", opened: !alreadyOpen };
	},

	openForTask(params: {
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

	async closeProjectSession(params: { projectId: string; projectName: string }): Promise<void> {
		await closeKwTerminalProject({
			projectId: params.projectId,
			sessionName: sessionNameFor(params.projectName),
		});
	},

	async closeTaskWindow(params: {
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

		await closeKwTerminalWindow({
			projectId: params.projectId,
			taskId: params.taskId,
			sessionName,
			windowName,
		});
	},

	// Fecha só as tabs de invocação dos projetos selecionados, preservando terminal/tarefas/rotas.
	// Workspaces que ficam sem tab podem ser encerrados pelo kw-terminal e o monitor emite
	// `session_closed`. Retorna quantas tabs foram fechadas.
	async closeInvocationSessions(params: {
		projects: { id: string; name: string }[];
	}): Promise<number> {
		let killed = 0;

		for (const project of params.projects) {
			const sessionName = sessionNameFor(project.name);
			const windowNames = await invocationWindowNames(project.id, sessionName);

			killed += await closeKwTerminalInvocationTabs(project.id, sessionName, windowNames);
		}

		return killed;
	},
};
