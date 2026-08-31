import { describe, expect, test } from "bun:test";

import { buildClaudeCodexDelegatePrompt } from "@/lib/build-prompt";

describe("buildClaudeCodexDelegatePrompt", () => {
	test("invoca o plugin Codex com Sol medium e converte skills internas para o Codex", () => {
		expect(
			buildClaudeCodexDelegatePrompt({
				prompt: "/kw tarefas/feature.md\n\nUse /plan para implementar",
				model: "gpt-5.6-sol",
				effort: "medium",
			}),
		).toBe(
			"/codex:rescue --fresh --model gpt-5.6-sol --effort medium -- $kw tarefas/feature.md\n\nUse $plan para implementar",
		);
	});

	test("protege flags que fazem parte do texto da tarefa", () => {
		expect(
			buildClaudeCodexDelegatePrompt({
				prompt: "Documente --model e não use --resume nesta tarefa",
				model: "gpt-5.6-sol",
				effort: "medium",
			}),
		).toBe(
			"/codex:rescue --fresh --model gpt-5.6-sol --effort medium -- Documente --model e não use --resume nesta tarefa",
		);
	});

	test("não produz uma invocação sem tarefa", () => {
		expect(
			buildClaudeCodexDelegatePrompt({
				prompt: "   ",
				model: "gpt-5.6-sol",
				effort: "medium",
			}),
		).toBe("");
	});
});
