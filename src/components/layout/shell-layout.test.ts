import { describe, expect, test } from "bun:test";

import { resolveAgentDockMode } from "./shell-layout";

describe("resolveAgentDockMode", () => {
	test("mantém launcher fora do fluxo quando recolhido", () => {
		expect(resolveAgentDockMode({ expanded: false, terminalOnScreen: false })).toBe("launcher");
	});

	test("abre dock lateral quando não há terminal", () => {
		expect(resolveAgentDockMode({ expanded: true, terminalOnScreen: false })).toBe("dock");
	});

	test("sobrepõe o dock quando um terminal está na tela", () => {
		expect(resolveAgentDockMode({ expanded: true, terminalOnScreen: true })).toBe("overlay");
	});
});
