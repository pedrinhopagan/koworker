import { afterAll, expect, test } from "bun:test";

import { PubSub } from "../../pubsub";
import { sessionNameForProject } from "./names";
import { Terminal, type TerminalConfig } from "./service";
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
