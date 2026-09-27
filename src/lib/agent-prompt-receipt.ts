import type { AgentSessionEvent } from "./agent-session";

const UNCONFIRMED_MS = 15_000;

export type PendingPrompt = {
	id: string;
	text: string;
	baseline: number;
	sentAt: number;
	command: boolean;
};

export type OutgoingPrompt = {
	key: string;
	text: string;
	state: "queued" | "waiting" | "sending" | "unconfirmed";
	pendingId?: string;
};

function normalize(text: string) {
	return text.replaceAll(/\s+/g, " ").trim();
}

function promptState(input: { queued: boolean; busy: boolean; fresh: boolean }) {
	if (input.queued) {
		return "queued";
	}
	if (input.busy) {
		return "waiting";
	}

	return input.fresh ? "sending" : "unconfirmed";
}

export function countPromptReceipts(events: AgentSessionEvent[], text: string) {
	const normalized = normalize(text);
	return events.filter(
		(event) => event.payload.kind === "user" && normalize(event.payload.text).includes(normalized),
	).length;
}

export function nextPendingPrompt(input: {
	text: string;
	events: AgentSessionEvent[];
	pending: PendingPrompt[];
	now: number;
}): PendingPrompt {
	const normalized = normalize(input.text);

	return {
		id: crypto.randomUUID(),
		text: input.text,
		baseline:
			countPromptReceipts(input.events, input.text) +
			input.pending.filter((prompt) => normalize(prompt.text) === normalized).length,
		sentAt: input.now,
		command: input.text.startsWith("/"),
	};
}

export function outgoingPrompts(input: {
	pending: PendingPrompt[];
	queued: string[];
	events: AgentSessionEvent[];
	busy: boolean;
	now: number;
}) {
	const queued = input.queued.map(normalize);
	const delivered: string[] = [];
	const items: OutgoingPrompt[] = [];

	for (const prompt of input.pending) {
		const age = input.now - prompt.sentAt;
		if (
			countPromptReceipts(input.events, prompt.text) > prompt.baseline ||
			(prompt.command && age >= UNCONFIRMED_MS)
		) {
			delivered.push(prompt.id);
			continue;
		}

		const inQueue = queued.indexOf(normalize(prompt.text));
		if (inQueue !== -1) {
			queued[inQueue] = "";
		}

		items.push({
			key: prompt.id,
			pendingId: prompt.id,
			text: prompt.text,
			state: promptState({
				queued: inQueue !== -1,
				busy: input.busy,
				fresh: age < UNCONFIRMED_MS || prompt.command,
			}),
		});
	}

	queued.forEach((text, index) => {
		if (text) {
			items.push({ key: `queued-${index}`, text: input.queued[index] ?? text, state: "queued" });
		}
	});

	return { items, delivered };
}
