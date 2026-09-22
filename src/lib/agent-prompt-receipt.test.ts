import { expect, test } from "bun:test";
import type { AgentSessionEvent } from "./agent-session";
import { countPromptReceipts, waitForPromptReceipt } from "./agent-prompt-receipt";

function message(seq: number, kind: "user" | "assistant", text: string): AgentSessionEvent {
	return { id: String(seq), seq, sessionId: "test", at: seq, payload: { kind, text } };
}

test("exige um novo registro do usuário, não uma resposta ou mensagem antiga", async () => {
	const events = [message(0, "user", "teste"), message(1, "assistant", "teste")];
	const previousCount = countPromptReceipts(events, "teste");
	expect(previousCount).toBe(1);
	const controller = new AbortController();
	const result = waitForPromptReceipt({
		text: "teste",
		previousCount,
		events: () => events,
		signal: controller.signal,
	});
	events.push(message(2, "user", "teste"));
	expect(await result).toBe(true);
});

test("cancelamento preserva mensagem sem confirmação", async () => {
	const controller = new AbortController();
	controller.abort();
	expect(
		await waitForPromptReceipt({
			text: "teste",
			previousCount: 0,
			events: () => [],
			signal: controller.signal,
		}),
	).toBe(false);
});
