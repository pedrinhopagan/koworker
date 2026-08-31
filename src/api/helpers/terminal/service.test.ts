import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PubSub } from "../../pubsub";
import { sessionNameForProject } from "./names";
import type { KwTerminalAgent } from "./kw-terminal";
import {
	selectAgentForCli,
	Terminal,
	terminalMultiplexerAdapter,
	type TerminalConfig,
	type TerminalMultiplexerAdapter,
} from "./service";
import { tmuxKillSession, tmuxListWindows, tmuxSessionExists } from "./tmux";

// Ciclo de vida real do modo tmux, sem GUI: `background: true` cria a sessão/janela no tmux mas não
// spawna o emulador. O template é irrelevante nesse caminho, então um `true {command}` fake basta.
const hasTmux = !!Bun.which("tmux");

const projectId = `proj-${process.pid}`;
const projectName = `kwtest${process.pid}`;
const sessionName = sessionNameForProject(projectName);
const config: TerminalConfig = { template: "true {command}", multiplexer: "tmux" };
const project = { id: projectId, name: projectName };

afterAll(async () => {
	if (hasTmux) {
		await tmuxKillSession(sessionName);
	}
});

function agentFixture(agent: string, cwd: string): KwTerminalAgent {
	return {
		agent,
		agent_status: "idle",
		cwd,
		foreground_cwd: cwd,
		focused: false,
		pane_id: `pane-${cwd}`,
		tab_id: `tab-${cwd}`,
		terminal_id: `term-${agent}-${cwd}`,
		workspace_id: `ws-${cwd}`,
	};
}

const agents = [
	agentFixture("codex", "/proj/app"),
	agentFixture("claude", "/proj/app/pacote"),
	agentFixture("claude", "/proj/app"),
	agentFixture("claude", "/proj/outro"),
];

test("cada multiplexador resolve um adapter explícito com o mesmo contrato", () => {
	for (const multiplexer of ["none", "kw-terminal", "tmux"] as const) {
		const adapter = terminalMultiplexerAdapter(multiplexer);

		expect(adapter.multiplexer).toBe(multiplexer);
		expect(typeof adapter.open).toBe("function");
		expect(typeof adapter.windowExists).toBe("function");
		expect(typeof adapter.invocationWindowNames).toBe("function");
		expect(typeof adapter.closeProject).toBe("function");
		expect(typeof adapter.closeWindow).toBe("function");
		expect(typeof adapter.closeInvocationWindows).toBe("function");
		expect(typeof adapter.focusAgent).toBe("function");
		expect(typeof adapter.monitor).toBe("function");
	}
});

function memoryAdapter(
	multiplexer: TerminalMultiplexerAdapter["multiplexer"],
): TerminalMultiplexerAdapter {
	const windows = new Set<string>();

	return {
		multiplexer,
		open: (params) => {
			const isNewWindow = !windows.has(params.windowName);
			windows.add(params.windowName);

			return Promise.resolve({
				sessionName: params.sessionName,
				windowName: params.windowName,
				isNewSession: windows.size === 1,
				isNewWindow,
			});
		},
		windowExists: (params) => Promise.resolve(windows.has(params.windowName)),
		invocationWindowNames: () =>
			Promise.resolve(
				[...windows].filter(
					(windowName) => windowName.startsWith("agent_") || windowName.startsWith("skill_"),
				),
			),
		closeProject: () => {
			windows.clear();

			return Promise.resolve();
		},
		closeWindow: (params) => {
			windows.delete(params.windowName);

			return Promise.resolve();
		},
		closeInvocationWindows: (params) => {
			let closed = 0;
			for (const windowName of params.windowNames) {
				if (windows.delete(windowName)) {
					closed += 1;
				}
			}

			return Promise.resolve(closed);
		},
		focusAgent: () => Promise.resolve(null),
		monitor: () => Promise.resolve(),
	};
}

for (const multiplexer of ["none", "kw-terminal", "tmux"] as const) {
	test(`${multiplexer}: cumpre o contrato comportamental em memória`, async () => {
		const adapter = memoryAdapter(multiplexer);
		const base = {
			config: { template: "true {command}", multiplexer },
			projectId: "project-memory",
			projectName: "Memory",
			workingDir: "/tmp",
			taskId: "task-memory",
			tab: { kind: "task" as const, taskId: "task-memory", title: "Memory" },
			command: undefined,
			forceNew: false,
			background: true,
			killExistingOnForceNew: false,
			sessionName: "kw_memory",
		};

		const task = await adapter.open({ ...base, windowName: "task_memory" });
		const invocation = await adapter.open({ ...base, windowName: "agent_review" });

		expect(task.isNewSession).toBe(true);
		expect(invocation.isNewWindow).toBe(true);
		expect(await adapter.windowExists({ ...base, windowName: "task_memory" })).toBe(true);
		expect(await adapter.invocationWindowNames(base)).toEqual(["agent_review"]);
		expect(await adapter.closeInvocationWindows({ ...base, windowNames: ["agent_review"] })).toBe(
			1,
		);
		expect(await adapter.windowExists({ ...base, windowName: "agent_review" })).toBe(false);

		await adapter.closeWindow({ ...base, windowName: "task_memory" });
		expect(await adapter.windowExists({ ...base, windowName: "task_memory" })).toBe(false);
		await adapter.monitor();
		expect(
			await adapter.focusAgent({ config: base.config, cli: "codex", mainRoute: "/tmp" }),
		).toBeNull();
		await adapter.closeProject(base);
	});
}

test("escolhe o agent do cli no cwd exato do projeto", () => {
	expect(selectAgentForCli({ agents, cli: "claude", mainRoute: "/proj/app" })?.cwd).toBe(
		"/proj/app",
	);
	expect(selectAgentForCli({ agents, cli: "codex", mainRoute: "/proj/app" })?.cwd).toBe(
		"/proj/app",
	);
});

test("aceita subpasta do projeto quando não há agent na raiz", () => {
	const semRaiz = agents.filter((agent) => agent.cwd !== "/proj/app");

	expect(selectAgentForCli({ agents: semRaiz, cli: "claude", mainRoute: "/proj/app" })?.cwd).toBe(
		"/proj/app/pacote",
	);
});

test("não cai para o agent de outro projeto", () => {
	expect(selectAgentForCli({ agents, cli: "claude", mainRoute: "/proj/vazio" })).toBeNull();
	expect(selectAgentForCli({ agents, cli: "codex", mainRoute: "/proj/outro" })).toBeNull();
});

test("sem projeto em foco não foca sessão nenhuma", () => {
	expect(selectAgentForCli({ agents, cli: "claude" })).toBeNull();
	expect(selectAgentForCli({ agents, cli: "codex" })).toBeNull();
});

test("reconhece o agent aberto pelo caminho real de um projeto com symlink", () => {
	const root = mkdtempSync(join(tmpdir(), "kowork-terminal-symlink-"));
	const realRoot = join(root, "dogama-app");
	const aliasRoot = join(root, "Dogama");
	mkdirSync(realRoot);
	symlinkSync(realRoot, aliasRoot);

	try {
		const agent = agentFixture("claude", realRoot);
		expect(selectAgentForCli({ agents: [agent], cli: "claude", mainRoute: aliasRoot })).toBe(agent);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test.skipIf(!hasTmux)("abre a sessão em background e rastreia a janela da tarefa", async () => {
	const result = await Terminal.openForTask({
		config,
		projectId,
		projectName,
		mainRoute: process.cwd(),
		taskId: "abcd1234ef",
		taskTitle: "Minha Tarefa",
		background: true,
	});

	expect(result.isNewSession).toBe(true);
	expect(result.isNewWindow).toBe(true);
	expect(await tmuxSessionExists(sessionName)).toBe(true);
	expect(await tmuxListWindows(sessionName)).toContain(result.windowName);
});

test.skipIf(!hasTmux)("reabrir a mesma tarefa não recria sessão nem janela", async () => {
	const result = await Terminal.openForTask({
		config,
		projectId,
		projectName,
		mainRoute: process.cwd(),
		taskId: "abcd1234ef",
		taskTitle: "Minha Tarefa",
		background: true,
	});

	expect(result.isNewSession).toBe(false);
	expect(result.isNewWindow).toBe(false);
});

test.skipIf(!hasTmux)("lista e fecha só as invocações, preservando a tarefa", async () => {
	const invocation = await Terminal.openForTask({
		config,
		projectId,
		projectName,
		mainRoute: process.cwd(),
		taskId: "skill_foobar",
		taskTitle: "Foo",
		background: true,
	});

	const listed = await Terminal.listInvocationSessions({ config, projects: [project] });
	expect(listed.find((info) => info.projectId === projectId)?.windowCount).toBeGreaterThanOrEqual(
		1,
	);

	const killed = await Terminal.closeInvocationSessions({ config, projects: [project] });
	expect(killed).toBeGreaterThanOrEqual(1);

	const windows = await tmuxListWindows(sessionName);
	expect(windows).not.toContain(invocation.windowName);
	expect(windows).toContain("abcd1234_minha_tarefa");
});

test.skipIf(!hasTmux)("fecha a sessão inteira do projeto", async () => {
	await Terminal.closeProjectSession({ config, projectId, projectName });
	expect(await tmuxSessionExists(sessionName)).toBe(false);
});

// Modo none, sem multiplexador: cada abertura spawna uma janela nova (aqui um `sleep` headless que
// faz de emulador de longa duração) e o fechamento é detectado pelo `.exited` do processo, que emite
// window_closed e, ao esvaziar a sessão, session_closed.
const hasSleep = !!Bun.which("sleep");
const noneConfig: TerminalConfig = { template: "sleep 30", multiplexer: "none" };
const noneProject = { id: `none-${process.pid}`, name: `KwNone${process.pid}` };

test.skipIf(!hasSleep)(
	"none: cada abertura vira janela nova e o fechamento é detectado",
	async () => {
		const open1 = await Terminal.openForTask({
			config: noneConfig,
			projectId: noneProject.id,
			projectName: noneProject.name,
			mainRoute: process.cwd(),
			taskId: "t1",
			taskTitle: "Tarefa",
		});
		const open2 = await Terminal.openForTask({
			config: noneConfig,
			projectId: noneProject.id,
			projectName: noneProject.name,
			mainRoute: process.cwd(),
			taskId: "t1",
			taskTitle: "Tarefa",
		});

		expect(open1.isNewSession).toBe(true);
		expect(open1.isNewWindow).toBe(true);
		expect(open2.isNewSession).toBe(false);
		expect(open2.isNewWindow).toBe(true);

		const controller = new AbortController();
		const seen: string[] = [];
		const sawSessionClosed = new Promise<void>((resolve) => {
			void (async () => {
				for await (const event of PubSub.terminal.subscribe(controller.signal)) {
					seen.push(event.eventType);
					if (event.eventType === "session_closed") {
						resolve();
						return;
					}
				}
			})();
		});

		await Bun.sleep(20);
		await Terminal.closeProjectSession({
			config: noneConfig,
			projectId: noneProject.id,
			projectName: noneProject.name,
		});
		await sawSessionClosed;
		controller.abort();

		expect(seen).toContain("window_closed");
		expect(seen).toContain("session_closed");
	},
);
