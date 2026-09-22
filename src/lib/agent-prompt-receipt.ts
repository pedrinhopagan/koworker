import type { AgentSessionEvent } from "./agent-session";

export function countPromptReceipts(events: AgentSessionEvent[], text: string) {
	return events.filter(
		(event) => event.payload.kind === "user" && event.payload.text.includes(text),
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
