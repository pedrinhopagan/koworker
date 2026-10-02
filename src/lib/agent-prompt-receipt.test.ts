import { expect, test } from "bun:test";
import type { AgentSessionEvent } from "./agent-session";
import { countPromptReceipts, nextPendingPrompt, outgoingPrompts } from "./agent-prompt-receipt";

function message(seq: number, kind: "user" | "assistant", text: string): AgentSessionEvent {
	return { id: String(seq), seq, sessionId: "test", at: seq, payload: { kind, text } };
}

test("exige um novo registro do usuário, não uma resposta ou mensagem antiga", () => {
	const events = [message(0, "user", "teste"), message(1, "assistant", "teste")];
	const prompt = nextPendingPrompt({ text: "teste", events, pending: [], now: 0 });

	expect(countPromptReceipts(events, "teste")).toBe(1);
	expect(outgoingPrompts({ pending: [prompt], queued: [], events, busy: false, now: 1 })).toEqual({
		items: [{ key: prompt.id, pendingId: prompt.id, text: "teste", state: "sending" }],
		delivered: [],
	});

	events.push(message(2, "user", "teste"));

	expect(
		outgoingPrompts({ pending: [prompt], queued: [], events, busy: false, now: 2 }).delivered,
	).toEqual([prompt.id]);
});

test("a mesma mensagem enviada duas vezes espera dois registros", () => {
	const first = nextPendingPrompt({ text: "de novo", events: [], pending: [], now: 0 });
	const second = nextPendingPrompt({ text: "de novo", events: [], pending: [first], now: 0 });
	const events = [message(0, "user", "de novo")];

	expect(
		outgoingPrompts({ pending: [first, second], queued: [], events, busy: false, now: 1 })
			.delivered,
	).toEqual([first.id]);
});

test("a fila do agente confirma a mensagem e mostra o que foi enfileirado no terminal", () => {
	const prompt = nextPendingPrompt({ text: "ajuste  o\nheader", events: [], pending: [], now: 0 });

	expect(
		outgoingPrompts({
			pending: [prompt],
			queued: ["ajuste o header", "digitada no terminal"],
			events: [],
			busy: true,
			now: 60_000,
		}).items.map((item) => [item.text, item.state]),
	).toEqual([
		["ajuste  o\nheader", "queued"],
		["digitada no terminal", "queued"],
	]);
});

test("sem registro nem fila, a mensagem espera o agente e só vira alerta com ele parado", () => {
	const prompt = nextPendingPrompt({ text: "continue", events: [], pending: [], now: 0 });
	const command = nextPendingPrompt({ text: "/model", events: [], pending: [], now: 0 });
	const state = (busy: boolean, now: number) =>
		outgoingPrompts({ pending: [prompt, command], queued: [], events: [], busy, now });

	expect(state(true, 60_000).items.map((item) => item.state)).toEqual(["waiting"]);
	expect(state(false, 5_000).items.map((item) => item.state)).toEqual(["sending", "sending"]);
	expect(state(false, 20_000).items.map((item) => item.state)).toEqual(["unconfirmed"]);
	expect(state(false, 20_000).delivered).toEqual([command.id]);
});
