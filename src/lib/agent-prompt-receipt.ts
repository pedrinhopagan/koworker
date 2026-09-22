import type { AgentSessionEvent } from "./agent-session";

export function countPromptReceipts(events: AgentSessionEvent[], text: string) {
	const normalized = text.replaceAll(/\s+/g, " ").trim();
	return events.filter(
		(event) =>
			event.payload.kind === "user" &&
			event.payload.text.replaceAll(/\s+/g, " ").trim().includes(normalized),
	).length;
}

export async function waitForPromptReceipt(input: {
	text: string;
	previousCount: number;
	events: () => AgentSessionEvent[];
	signal: AbortSignal;
}) {
	const deadline = Date.now() + 5_000;
	while (!input.signal.aborted) {
		if (countPromptReceipts(input.events(), input.text) > input.previousCount) {
			return true;
		}
		if (Date.now() >= deadline) {
			return false;
		}
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 100);
		});
	}
	return false;
}
