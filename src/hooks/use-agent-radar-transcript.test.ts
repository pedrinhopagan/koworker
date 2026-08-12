import { expect, test } from "bun:test";

import type { AgentSessionEvent } from "@/lib/agent-session";
import {
	applyAgentRadarTranscriptEnvelope,
	applyAgentRadarTranscriptSource,
} from "./use-agent-radar-transcript";

function event(seq: number, text: string): AgentSessionEvent {
	return {
		id: String(seq),
		sessionId: "pane",
		seq,
		at: seq,
		payload: { kind: "assistant", text },
	};
}

test("reconexão reaplica o snapshot atual sem duplicar eventos", () => {
	const snapshot = [event(1, "um"), event(2, "dois")];
	const first = applyAgentRadarTranscriptEnvelope([], { reset: true, events: snapshot });
	const reconnected = applyAgentRadarTranscriptEnvelope(first, { reset: true, events: snapshot });

	expect(reconnected).toEqual(snapshot);
	expect(reconnected).toHaveLength(2);
});

test("lote incremental atualiza por seq depois do snapshot", () => {
	const current = [event(1, "antes")];
	const next = applyAgentRadarTranscriptEnvelope(current, {
		events: [event(1, "depois"), event(2, "novo")],
	});

	expect(next.map((item) => item.payload)).toEqual([
		{ kind: "assistant", text: "depois" },
		{ kind: "assistant", text: "novo" },
	]);
});

test("reset sem source remove toda identidade da sessão anterior", () => {
	const envelope = { missing: true, reset: true, events: [] };
	const oldEvent = event(0, "conversa antiga");

	expect(applyAgentRadarTranscriptEnvelope([oldEvent], envelope)).toEqual([]);
	expect(
		applyAgentRadarTranscriptSource({ cli: "codex", path: "/tmp/rollout-antigo.jsonl" }, envelope),
	).toBeNull();
});
