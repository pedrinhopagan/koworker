import type { AgentSessionEvent } from "@/lib/agent-session";

export type AgentTranscript =
	| { cli: "claude" | "codex"; path: string; sessionId?: string }
	| { cli: "opencode"; path: string; sessionId: string };

export type AgentRadarTranscriptEnvelope = {
	paneId: string;
	events?: AgentSessionEvent[];
	reset?: boolean;
	source?: AgentTranscript;
	missing?: boolean;
	model?: string;
};
