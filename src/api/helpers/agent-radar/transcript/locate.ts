import { homedir } from "node:os";
import { join } from "node:path";
import type { RadarAgent } from "@/api/schemas/terminal-workspace";
import type { AgentTranscript } from "@/api/schemas/agent-radar-transcript";

const TRANSCRIPT_CLIS = ["claude", "codex", "opencode"] as const;

export type TranscriptCli = (typeof TRANSCRIPT_CLIS)[number];

// O claude e o codex guardam a conversa num arquivo por sessão; o opencode guarda todas no mesmo
// banco SQLite, então a fonte carrega também o id que acha a conversa lá dentro.
const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");
const CODEX_SESSIONS_DIR = join(homedir(), ".codex", "sessions");
const OPENCODE_DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");
const SESSION_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

type TranscriptDirectories = {
	claudeProjectsDir: string;
	codexSessionsDir: string;
	opencodeDbPath: string;
};

const DEFAULT_TRANSCRIPT_DIRECTORIES: TranscriptDirectories = {
	claudeProjectsDir: CLAUDE_PROJECTS_DIR,
	codexSessionsDir: CODEX_SESSIONS_DIR,
	opencodeDbPath: OPENCODE_DB_PATH,
};

// O claude guarda a sessão numa pasta batizada pelo `cwd`, com todo caractere fora de letra e número
// virando hífen: `/mnt/data/Projects/koworker` vira `-mnt-data-Projects-koworker`.
export function claudeProjectSlug(cwd: string) {
	return cwd.replaceAll(/[^a-zA-Z0-9]/g, "-");
}

async function codexTranscript(sessionId: string, sessionsDir: string) {
	const compact = sessionId.replaceAll("-", "");
	if (/^[0-9a-f]{12}7[0-9a-f]{19}$/i.test(compact)) {
		const startedAt = new Date(Number.parseInt(compact.slice(0, 12), 16));
		const day = join(
			sessionsDir,
			String(startedAt.getFullYear()),
			String(startedAt.getMonth() + 1).padStart(2, "0"),
			String(startedAt.getDate()).padStart(2, "0"),
		);
		const exact = await Array.fromAsync(
			new Bun.Glob(`rollout-*-${sessionId}.jsonl`).scan({ cwd: day, absolute: true }),
		).catch(() => []);

		return exact[0] ?? null;
	}

	return (
		(
			await Array.fromAsync(
				new Bun.Glob(`*/*/*/rollout-*-${sessionId}.jsonl`).scan({
					cwd: sessionsDir,
					absolute: true,
				}),
			).catch(() => [])
		)[0] ?? null
	);
}
function transcriptCli(agent: string): TranscriptCli | null {
	return TRANSCRIPT_CLIS.find((cli) => cli === agent) ?? null;
}

export async function locateAgentTranscript(
	agent: Pick<RadarAgent, "agent" | "cwd" | "sessionId" | "sessionPath">,
	directories: TranscriptDirectories = DEFAULT_TRANSCRIPT_DIRECTORIES,
): Promise<AgentTranscript | null> {
	const cli = transcriptCli(agent.agent);
	if (!cli) {
		return null;
	}

	if (agent.sessionPath && cli !== "opencode") {
		return (await Bun.file(agent.sessionPath).exists()) ? { cli, path: agent.sessionPath } : null;
	}

	if (!agent.sessionId || !SESSION_ID_PATTERN.test(agent.sessionId)) {
		return null;
	}

	if (cli === "opencode") {
		return (await Bun.file(directories.opencodeDbPath).exists())
			? { cli, path: directories.opencodeDbPath, sessionId: agent.sessionId }
			: null;
	}

	const path =
		cli === "claude"
			? join(
					directories.claudeProjectsDir,
					claudeProjectSlug(agent.cwd),
					`${agent.sessionId}.jsonl`,
				)
			: await codexTranscript(agent.sessionId, directories.codexSessionsDir);

	return path && (await Bun.file(path).exists()) ? { cli, path } : null;
}
