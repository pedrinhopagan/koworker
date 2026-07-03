import { buildClaudeCommand } from "@/lib/claude-command";
import { buildCodexCommand } from "@/lib/codex-command";
import type { TerminalMultiplexer } from "@/constants/terminal";
import { PubSub, type TerminalEvent } from "../../pubsub";
import { buildNoneCommandArgv, type EmulatorProcess, spawnEmulator } from "./emulator";
import { focusTerminalWindow } from "./focus";
import {
	isInvocationWindow,
	sanitizeRouteName,
	sessionNameForProject,
	windowNameForTask,
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
};

type TrackedSession = {
	projectId: string;
	projectName: string;
	sessionName: string;
	multiplexer: TerminalMultiplexer;
	windows: TrackedWindow[];
};

// Estado em memória do serviço (o backend é um processo único e longo). No modo tmux é um espelho do
// que existe no tmux, usado pra casar a window morta com o taskId da UI; no modo none é a única fonte
// (não há daemon externo). O monitor cuida do tmux; o modo none usa os `.exited` dos processos.
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
	windowName: string;
	command: string | undefined;
	forceNew: boolean;
	background: boolean;
	// Rota com força-nova mata a window homônima antes de recriá-la; tarefa reaproveita.
	killExistingOnForceNew: boolean;
};

function openTerminal(params: OpenParams): Promise<OpenTerminalResult> {
	const sessionName = sessionNameForProject(params.projectName);

	if (params.config.multiplexer === "none") {
		return Promise.resolve(openNone({ ...params, sessionName }));
	}

	return openTmux({ ...params, sessionName });
}

async function openTmux(params: OpenParams & { sessionName: string }): Promise<OpenTerminalResult> {
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
				spawnAttach({ config, sessionName, title, workingDir });
				await Bun.sleep(300);
			}

			await focusTerminalWindow(projectName).catch(() => {});
			await tmuxSelectWindow(sessionName, windowName);
		}
	} else {
		await tmuxNewSession({ sessionName, workingDir, windowName });

		if (!background) {
			spawnAttach({ config, sessionName, title, workingDir });
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

	if (params.command && params.command.trim().length > 0) {
		await tmuxSendKeys(sessionName, windowName, params.command);
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

function spawnAttach(params: {
	config: TerminalConfig;
	sessionName: string;
	title: string;
	workingDir: string;
}) {
	spawnEmulator({
		template: params.config.template,
		title: params.title,
		commandArgv: ["tmux", "attach-session", "-t", params.sessionName],
		cwd: params.workingDir,
	});
}

function openNone(params: OpenParams & { sessionName: string }): OpenTerminalResult {
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

// Modo tmux: dedup por taskId (a mesma tarefa reaproveita a window). No modo none o tracking é feito
// direto em `openNone` (uma window por processo), então esta função só é chamada no fluxo tmux.
function trackWindow(params: {
	projectId: string;
	projectName: string;
	sessionName: string;
	multiplexer: TerminalMultiplexer;
	taskId: string;
	windowName: string;
}) {
	const existing = findSession(params.projectId);

	if (existing) {
		if (!existing.windows.some((window) => window.taskId === params.taskId)) {
			existing.windows.push({ taskId: params.taskId, windowName: params.windowName });
		}
		return;
	}

	sessions.push({
		projectId: params.projectId,
		projectName: params.projectName,
		sessionName: params.sessionName,
		multiplexer: params.multiplexer,
		windows: [{ taskId: params.taskId, windowName: params.windowName }],
	});
}

// Monitor do modo tmux: a cada 3s confere se cada sessão tmux rastreada ainda existe; a que sumiu (o
// usuário saiu de todas as windows) vira `session_closed`. `.unref()` deixa o processo do backend
// encerrar sem esperar o timer — o `Bun.serve` mantém o loop vivo em produção. Para sozinho quando
// não há mais nenhuma sessão tmux rastreada.
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
	for (const session of sessions.filter((candidate) => candidate.multiplexer === "tmux")) {
		if (!(await tmuxSessionExists(session.sessionName))) {
			sessions = sessions.filter((candidate) => candidate !== session);
			publish({
				eventType: "session_closed",
				projectId: session.projectId,
				sessionName: session.sessionName,
			});
		}
	}

	if (!sessions.some((session) => session.multiplexer === "tmux") && monitorTimer) {
		clearInterval(monitorTimer);
		monitorTimer = null;
	}
}

// Casa a window morta com o estado em memória pra emitir `window_closed` com o taskId certo (a UI
// solta a chave por ele). Pós-restart a window existe no tmux mas não em memória: sem evento — e
// também não havia estado de UI pra ela.
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

async function invocationWindowNames(params: {
	config: TerminalConfig;
	projectId: string;
	sessionName: string;
}): Promise<string[]> {
	const names =
		params.config.multiplexer === "none"
			? (findSession(params.projectId)?.windows.map((window) => window.windowName) ?? [])
			: await tmuxListWindows(params.sessionName);

	return names.filter(isInvocationWindow);
}

export const Terminal = {
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
		const command = params.prompt
			? params.cli === "codex"
				? buildCodexCommand({
						prompt: params.prompt,
						approvalMode: params.permissionMode ?? "bypass",
						...(params.model ? { model: params.model } : {}),
						...(params.effort ? { effort: params.effort } : {}),
					})
				: buildClaudeCommand({
						prompt: params.prompt,
						permissionMode: params.permissionMode ?? "bypass",
						...(params.agent ? { agent: params.agent } : {}),
						...(params.model ? { model: params.model } : {}),
						...(params.effort ? { effort: params.effort } : {}),
					})
			: undefined;

		return openTerminal({
			config: params.config,
			projectId: params.projectId,
			projectName: params.projectName,
			workingDir: params.mainRoute,
			taskId: params.taskId,
			windowName: windowNameForTask(params.taskId, params.taskTitle),
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
			windowName: sanitizeRouteName(params.routeName),
			command: params.command,
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
		const sessionName = sessionNameForProject(params.projectName);

		if (params.config.multiplexer === "none") {
			// O `.exited` de cada processo dispara handleNoneWindowClosed de forma assíncrona (não durante
			// este loop), então iterar o array vivo é seguro — nada o muta aqui.
			for (const window of findSession(params.projectId)?.windows ?? []) {
				window.process?.kill();
			}
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
		const sessionName = sessionNameForProject(params.projectName);
		const windowName = windowNameForTask(params.taskId, params.taskTitle);

		if (params.config.multiplexer === "none") {
			const window = findSession(params.projectId)?.windows.find(
				(candidate) => candidate.windowName === windowName,
			);
			window?.process?.kill();
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
				const sessionName = sessionNameForProject(project.name);
				const windowCount = (
					await invocationWindowNames({ config: params.config, projectId: project.id, sessionName })
				).length;

				return { projectId: project.id, projectName: project.name, sessionName, windowCount };
			}),
		);

		return infos.filter((info) => info.windowCount > 0);
	},

	// Fecha só as windows de invocação dos projetos selecionados, preservando terminal/tarefas/rotas.
	// No tmux, sessões que ficam sem window são encerradas pelo próprio tmux e o monitor emite
	// `session_closed`. Retorna quantas windows foram fechadas.
	async closeInvocationSessions(params: {
		config: TerminalConfig;
		projects: { id: string; name: string }[];
	}): Promise<number> {
		let killed = 0;

		for (const project of params.projects) {
			const sessionName = sessionNameForProject(project.name);
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
