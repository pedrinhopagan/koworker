import type { AgentSessionEvent } from "@/lib/agent-session";
import { commandLabel } from "@/lib/shell-command";

// Pensamento, ferramenta, aviso e narração entram no rastro; o resto da conversa é bloco próprio.
// A narração é o que mais repete: o agente anuncia cada passo antes de dar, e cada anúncio virava um
// cartão do tamanho de uma resposta. Aqui ela vale uma linha do rastro, e só a última fala do turno
// — a que ficou de pé quando o agente parou de trabalhar — é lida como resposta.
const TRAIL_KINDS = new Set(["thinking", "tool_use", "assistant"]);

const REPEAT_MIN = 3;
const RECENT_TEXT_LIMIT = 160;

export const TRAIL_LABELS = {
	thinking: "Pensando",
	assistant: "Narração",
} as const;

export type TrailStep =
	| { kind: "step"; key: string; event: AgentSessionEvent }
	| { kind: "repeat"; key: string; label: string; events: AgentSessionEvent[] };

export type TimelineGroup =
	| { kind: "trail"; key: string; steps: TrailStep[]; total: number }
	| { kind: "block"; key: string; event: AgentSessionEvent };

export function trailStepLabel(event: AgentSessionEvent) {
	const { payload } = event;

	if (payload.kind === "thinking") {
		return TRAIL_LABELS.thinking;
	}

	if (payload.kind === "assistant") {
		return TRAIL_LABELS.assistant;
	}

	if (payload.kind === "tool_use" && payload.label === "Terminal") {
		return commandLabel(payload.detail ?? "") ?? "Comando";
	}

	if (payload.kind === "notice" || payload.kind === "tool_use") {
		return payload.label;
	}

	return "Passo";
}

// Um comando de terminal descreve a si mesmo pelo programa que roda, então nunca é dobrado em
// contagem: oito chamadas do `agent-browser` continuam oito linhas legíveis.
function repeatKey(event: AgentSessionEvent) {
	if (event.payload.kind === "tool_use" && event.payload.label === "Terminal") {
		return null;
	}

	return `${event.payload.kind}:${trailStepLabel(event)}`;
}

function toSteps(events: AgentSessionEvent[]): TrailStep[] {
	const runs: AgentSessionEvent[][] = [];
	let current: string | null = null;

	for (const event of events) {
		const key = repeatKey(event);

		if (key && key === current) {
			runs.at(-1)?.push(event);
			continue;
		}

		current = key;
		runs.push([event]);
	}

	const steps: TrailStep[] = [];

	for (const run of runs) {
		const first = run[0];

		if (run.length >= REPEAT_MIN && first) {
			steps.push({
				kind: "repeat",
				key: `repeat-${first.seq}`,
				label: trailStepLabel(first),
				events: run,
			});
			continue;
		}

		for (const event of run) {
			steps.push({ kind: "step", key: String(event.seq), event });
		}
	}

	return steps;
}

export function toTimelineGroups(events: AgentSessionEvent[]): TimelineGroup[] {
	const raw: (AgentSessionEvent[] | AgentSessionEvent)[] = [];

	for (const event of events) {
		if (!TRAIL_KINDS.has(event.payload.kind)) {
			raw.push(event);
			continue;
		}

		const last = raw.at(-1);
		if (Array.isArray(last)) {
			last.push(event);
			continue;
		}

		raw.push([event]);
	}

	const groups: TimelineGroup[] = [];

	for (const entry of raw) {
		if (!Array.isArray(entry)) {
			groups.push({ kind: "block", key: String(entry.seq), event: entry });
			continue;
		}

		const answer = entry.at(-1)?.payload.kind === "assistant" ? entry.at(-1) : null;
		const trail = answer ? entry.slice(0, -1) : entry;

		if (trail.length > 0) {
			groups.push({
				kind: "trail",
				key: `trail-${trail[0]?.seq}`,
				steps: toSteps(trail),
				total: trail.length,
			});
		}

		if (answer) {
			groups.push({ kind: "block", key: String(answer.seq), event: answer });
		}
	}

	return groups;
}

export function recentTranscriptText(events: AgentSessionEvent[]) {
	for (const event of events.toReversed()) {
		if (event.payload.kind !== "user" && event.payload.kind !== "assistant") {
			continue;
		}

		const text = event.payload.text.trim();
		if (!text) {
			continue;
		}

		return text.length > RECENT_TEXT_LIMIT ? `${text.slice(0, RECENT_TEXT_LIMIT - 1)}…` : text;
	}

	return null;
}
