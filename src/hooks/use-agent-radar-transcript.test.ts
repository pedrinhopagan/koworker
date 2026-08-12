import { expect, test } from "bun:test";

import type { AgentSessionEvent } from "@/lib/agent-session";
import {
	applyAgentRadarTranscriptEnvelope,
	applyAgentRadarTranscriptSource,
} from "./use-agent-radar-transcript";

const oldEvent: AgentSessionEvent = {
	id: "old",
	sessionId: "pane",
	seq: 0,
	at: 1,
	payload: { kind: "user", text: "conversa antiga" },
};

test("reset sem source remove toda identidade da sessão anterior", () => {
	const envelope = { missing: true, reset: true, events: [] };

	expect(applyAgentRadarTranscriptEnvelope([oldEvent], envelope)).toEqual([]);
	expect(
		applyAgentRadarTranscriptSource({ cli: "codex", path: "/tmp/rollout-antigo.jsonl" }, envelope),
	).toBeNull();
});
