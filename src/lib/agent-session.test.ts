import { describe, expect, test } from "bun:test";

import {
	type AgentEventPayload,
	type AgentSessionEvent,
	blockingQuestion,
	lastTurnEnded,
	mergeAgentSessionEvents,
	parseAgentEventPayload,
	pendingInteraction,
} from "./agent-session";

function event(seq: number, payload: AgentSessionEvent["payload"]): AgentSessionEvent {
	return { id: `e${seq}`, sessionId: "s", seq, at: seq, payload };
}

describe("parseAgentEventPayload", () => {
	test("payload gravado volta como veio", () => {
		expect(parseAgentEventPayload('{"kind":"assistant","text":"oi"}')).toEqual({
			kind: "assistant",
			text: "oi",
		});
	});

	test("bloco corrompido vira aviso em vez de derrubar a conversa", () => {
		expect(parseAgentEventPayload("{corrompido")).toEqual({
			kind: "notice",
			label: "Bloco ilegível",
			tone: "error",
		});
	});
});

describe("mergeAgentSessionEvents", () => {
	test("reaplicar o mesmo lote não duplica e o bloco atualizado substitui o antigo", () => {
		const running = event(2, {
			kind: "tool_use",
			name: "Bash",
			label: "Terminal",
			status: "running",
		});
		const settled = event(2, {
			kind: "tool_use",
			name: "Bash",
			label: "Terminal",
			status: "ok",
		});
		const merged = mergeAgentSessionEvents(
			[event(1, { kind: "user", text: "oi" }), running],
			[running, settled],
		);

		expect(merged).toHaveLength(2);
		expect(merged.at(-1)?.payload).toMatchObject({ status: "ok" });
	});

	test("blocos fora de ordem são reordenados por seq", () => {
		const merged = mergeAgentSessionEvents(
			[event(3, { kind: "assistant", text: "fim" })],
			[event(1, { kind: "user", text: "começo" })],
		);

		expect(merged.map((item) => item.seq)).toEqual([1, 3]);
	});
});

describe("pendingInteraction", () => {
	test("permissão sem decisão segura a sessão", () => {
		const pending = pendingInteraction([
			event(1, { kind: "user", text: "vai" }),
			event(2, { kind: "permission", requestId: "r1", toolName: "Bash", label: "Terminal" }),
		]);

		expect(pending?.kind).toBe("permission");
	});

	test("permissão respondida e pergunta respondida liberam a sessão", () => {
		expect(
			pendingInteraction([
				event(1, {
					kind: "permission",
					requestId: "r1",
					toolName: "Bash",
					label: "Terminal",
					decision: "allow",
				}),
				event(2, {
					kind: "question",
					questionId: "q1",
					question: "qual?",
					options: [{ label: "a" }, { label: "b" }],
					multiSelect: false,
					answers: ["a"],
				}),
			]),
		).toBeNull();
	});

	test("o pedido mais recente é o que a rota destaca", () => {
		const pending = pendingInteraction([
			event(1, { kind: "permission", requestId: "r1", toolName: "Bash", label: "Terminal" }),
			event(2, {
				kind: "question",
				questionId: "q1",
				question: "qual?",
				options: [{ label: "a" }, { label: "b" }],
				multiSelect: false,
			}),
		]);

		expect(pending?.kind).toBe("question");
	});
});

test("pergunta pendente só trava enquanto o turno dela não terminou nem veio fala nova", () => {
	const at = (seq: number, payload: AgentEventPayload) => ({
		id: String(seq),
		sessionId: "s",
		seq,
		at: seq,
		payload,
	});
	const question = at(0, {
		kind: "question",
		questionId: "q",
		question: "Qual caminho?",
		options: [{ label: "A" }],
		multiSelect: false,
	});

	expect(blockingQuestion([question])?.questionId).toBe("q");
	expect(blockingQuestion([question, at(1, { kind: "user", text: "segue" })])).toBeNull();
	expect(
		blockingQuestion([
			{ ...question, payload: { ...question.payload, async: true } } as typeof question,
		]),
	).toBeNull();
	expect(
		lastTurnEnded([
			at(0, { kind: "result", status: "done" }),
			at(1, { kind: "notice", label: "x", tone: "info" }),
		]),
	).toBe(true);
	expect(
		lastTurnEnded([
			at(0, { kind: "result", status: "done" }),
			at(1, { kind: "user", text: "de novo" }),
		]),
	).toBe(false);
});
