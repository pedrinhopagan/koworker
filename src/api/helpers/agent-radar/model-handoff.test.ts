import { expect, test } from "bun:test";

import type { AgentSessionEvent } from "@/lib/agent-session";
import {
	HANDOFF_PROMPT,
	handoffOpeningPrompt,
	handoffQuestion,
	handoffSummary,
} from "./model-handoff";

function event(seq: number, payload: AgentSessionEvent["payload"]): AgentSessionEvent {
	return { id: String(seq), sessionId: "pane", seq, at: seq, payload };
}

test("o resumo é só a fala do agent depois do pedido", () => {
	const events = [
		event(0, { kind: "assistant", text: "conversa antiga" }),
		event(1, { kind: "user", text: HANDOFF_PROMPT }),
		event(2, { kind: "assistant", text: "Vou resumir." }),
		event(3, { kind: "tool_use", name: "Read", label: "Ler", status: "ok" }),
		event(4, { kind: "assistant", text: "## Pedido\n\nRefazer a UI." }),
	];

	expect(handoffSummary(events, 0)).toBe("Vou resumir.\n\n## Pedido\n\nRefazer a UI.");
	expect(handoffSummary(events.slice(0, 2), 0)).toBeNull();
});

test("o pedido de resumo cabe numa linha do prompt do TUI", () => {
	expect(HANDOFF_PROMPT).not.toContain("\n");
});

test("a abertura da nova sessão embala o resumo e a mensagem", () => {
	const prompt = handoffOpeningPrompt({ from: "Claude Code", summary: "## Pedido", text: "segue" });

	expect(prompt).toContain("conduzida no Claude Code");
	expect(prompt).toContain(
		"<resumo-da-sessao-anterior>\n\n## Pedido\n\n</resumo-da-sessao-anterior>",
	);
	expect(prompt.endsWith("Nova mensagem do usuário:\n\nsegue")).toBe(true);
});

test("pergunta sem resposta depois do pedido interrompe a migração", () => {
	const question = {
		kind: "question" as const,
		questionId: "q1",
		question: "Qual formato?",
		options: [],
		multiSelect: false,
	};

	expect(handoffQuestion([event(1, question)], 0)).toBe(true);
	expect(handoffQuestion([event(1, { ...question, answers: ["md"] })], 0)).toBe(false);
	expect(handoffQuestion([event(0, question)], 0)).toBe(false);
});
