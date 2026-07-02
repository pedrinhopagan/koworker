import { expect, test } from "bun:test";

import {
	isInvocationWindow,
	sanitizeRouteName,
	sessionNameForProject,
	windowNameForTask,
} from "./names";

// Paridade com os nomes que o Rust do terminal gerava: sessões tmux criadas por versões anteriores
// precisam continuar sendo encontradas pelo mesmo nome após o restart.
test("sessionNameForProject: primeira palavra, minúscula, prefixo kw_", () => {
	expect(sessionNameForProject("My Project")).toBe("kw_my");
	expect(sessionNameForProject("koworker-app extra")).toBe("kw_koworker-app");
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
