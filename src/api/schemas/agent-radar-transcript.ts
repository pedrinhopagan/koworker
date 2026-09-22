import type { AgentSessionEvent } from "@/lib/agent-session";

export type AgentTranscript = { cwd?: string } & (
	| { cli: "claude" | "codex"; path: string; sessionId?: string }
	| { cli: "opencode"; path: string; sessionId: string }
	| { cli: "opencode2"; path: string; sessionId: string }
);

export type AgentRadarTranscriptEnvelope = {
	paneId: string;
	events?: AgentSessionEvent[];
	reset?: boolean;
	source?: AgentTranscript;
	missing?: boolean;
	model?: string;
	effort?: string;
};
