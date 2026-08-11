import { expect, test } from "bun:test";

import {
	invocationTabName,
	isInvocationWindow,
	sanitizeRouteName,
	sessionNameForProject,
	terminalTabLabel,
	windowNameForTask,
} from "./names";

test("sessionNameForProject: usa o nome inteiro para separar projetos", () => {
	expect(sessionNameForProject("Dogama")).toBe("kw_dogama");
	expect(sessionNameForProject("Dogama Vault")).toBe("kw_dogama-vault");
	expect(sessionNameForProject("koworker-app extra")).toBe("kw_koworker-app-extra");
});

test("sessionNameForProject: vazio ou só símbolos cai em projeto", () => {
	expect(sessionNameForProject("   ")).toBe("kw_projeto");
	expect(sessionNameForProject("!!!")).toBe("kw_projeto");
});

test("windowNameForTask: id8 + título sanitizado", () => {
	expect(windowNameForTask("abcd1234ef", "Minha Tarefa")).toBe("abcd1234_minha_tarefa");
	expect(windowNameForTask("skill_foobar", "Foo")).toBe("skill_fo_foo");
});

test("windowNameForTask: título vazio deixa só o id8", () => {
	expect(windowNameForTask("short", "")).toBe("short");
	expect(windowNameForTask("abcd1234ef", "***")).toBe("abcd1234");
});

test("sanitizeRouteName: minúsculo, espaço vira _, sem símbolos e sem hífen", () => {
	expect(sanitizeRouteName("My Route!")).toBe("my_route");
	expect(sanitizeRouteName("Build-Prod")).toBe("buildprod");
});

test("isInvocationWindow: só agent_/skill_", () => {
	expect(isInvocationWindow("agent_kw")).toBe(true);
	expect(isInvocationWindow("skill_fo_foo")).toBe(true);
	expect(isInvocationWindow("abcd1234_minha_tarefa")).toBe(false);
	expect(isInvocationWindow("build")).toBe(false);
});

test("invocationTabName: prefixo do tipo + slug, com hífen preservado", () => {
	expect(invocationTabName("agent", "task-runner")).toBe("agent_task-runner");
	expect(invocationTabName("skill", "Merge Worktree")).toBe("skill_merge_worktree");
	expect(invocationTabName("agent", "!!!")).toBe("agent_sem-nome");
});

test("terminalTabLabel: um rótulo por alvo, sem ninguém montar o nome à mão", () => {
	expect(terminalTabLabel({ kind: "task", taskId: "abcd1234ef", title: "Minha Tarefa" })).toBe(
		"abcd1234_minha_tarefa",
	);
	expect(terminalTabLabel({ kind: "run", runId: "abcd1234ef", title: "Job" })).toBe("abcd1234_job");
	expect(terminalTabLabel({ kind: "route", name: "Build Prod" })).toBe("build_prod");
	expect(terminalTabLabel({ kind: "cli", cli: "codex" })).toBe("cli_codex");
	expect(terminalTabLabel({ kind: "invocation", invoked: "skill", slug: "commit" })).toBe(
		"skill_commit",
	);
	expect(terminalTabLabel({ kind: "session", label: "Retomar claude" })).toBe(
		"sess_retomar_claude",
	);
});

test("terminalTabLabel: invocação é reconhecida pelo filtro de varredura", () => {
	expect(
		isInvocationWindow(terminalTabLabel({ kind: "invocation", invoked: "agent", slug: "kw" })),
	).toBe(true);
	expect(isInvocationWindow(terminalTabLabel({ kind: "cli", cli: "claude" }))).toBe(false);
	expect(isInvocationWindow(terminalTabLabel({ kind: "session", label: "livre" }))).toBe(false);
});
