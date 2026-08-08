import type { RadarAgent } from "../state";

const TRANSCRIPT_CLIS = ["claude", "codex"] as const;

export type TranscriptCli = (typeof TRANSCRIPT_CLIS)[number];

export type AgentTranscript = { cli: TranscriptCli; path: string };

function transcriptCli(agent: string): TranscriptCli | null {
	return TRANSCRIPT_CLIS.find((cli) => cli === agent) ?? null;
}

export function locateAgentTranscript(
	agent: Pick<RadarAgent, "agent" | "sessionPath">,
): AgentTranscript | null {
	const cli = transcriptCli(agent.agent);
	if (!cli || !agent.sessionPath?.trim()) {
		return null;
	}

	return { cli, path: agent.sessionPath };
}
