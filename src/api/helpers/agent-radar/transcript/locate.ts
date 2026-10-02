import { homedir } from "node:os";
import { join } from "node:path";
import type { RadarAgent } from "@/api/schemas/terminal-workspace";
import type { AgentTranscript } from "@/api/schemas/agent-radar-transcript";

const TRANSCRIPT_CLIS = ["claude", "codex", "pi", "opencode", "opencode2"] as const;

export type TranscriptCli = (typeof TRANSCRIPT_CLIS)[number];

// O claude e o codex guardam a conversa num arquivo por sessão; o opencode guarda todas no mesmo
// banco SQLite — as duas versões dele no mesmo arquivo, em tabelas diferentes — então a fonte
// carrega também o id que acha a conversa lá dentro.
const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");
const CODEX_SESSIONS_DIR = join(homedir(), ".codex", "sessions");
const OPENCODE_DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");
const PI_SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");
const SESSION_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

type TranscriptDirectories = {
	claudeProjectsDir: string;
	codexSessionsDir: string;
	opencodeDbPath: string;
	piSessionsDir?: string;
};

const DEFAULT_TRANSCRIPT_DIRECTORIES: TranscriptDirectories = {
	claudeProjectsDir: CLAUDE_PROJECTS_DIR,
	codexSessionsDir: CODEX_SESSIONS_DIR,
	opencodeDbPath: OPENCODE_DB_PATH,
	piSessionsDir: PI_SESSIONS_DIR,
};

async function piTranscript(sessionId: string, sessionsDir: string) {
	return (
		(
			await Array.fromAsync(
				new Bun.Glob(`*/*_${sessionId}.jsonl`).scan({ cwd: sessionsDir, absolute: true }),
			).catch(() => [])
		)[0] ?? null
	);
}

// O `cwd` que o terminal anuncia nem sempre é o que o claude usou para batizar a pasta (symlink,
// agente aberto num subdiretório, pane que trocou de diretório): a pasta do `cwd` é o atalho, e o id,
// que é único entre projetos, acha o arquivo nas outras.
async function claudeTranscript(sessionId: string, cwd: string, projectsDir: string) {
	const direct = join(projectsDir, claudeProjectSlug(cwd), `${sessionId}.jsonl`);
	if (await Bun.file(direct).exists()) {
		return direct;
	}

	return (
		(
			await Array.fromAsync(
				new Bun.Glob(`*/${sessionId}.jsonl`).scan({ cwd: projectsDir, absolute: true }),
			).catch(() => [])
		)[0] ?? null
	);
}

// O claude guarda a sessão numa pasta batizada pelo `cwd`, com todo caractere fora de letra e número
// virando hífen: `/mnt/data/Projects/koworker` vira `-mnt-data-Projects-koworker`.
export function claudeProjectSlug(cwd: string) {
	return cwd.replaceAll(/[^a-zA-Z0-9]/g, "-");
}

// Id do codex é UUIDv7: os primeiros 48 bits são o instante em que a sessão nasceu.
export function codexSessionStartedAt(sessionId: string) {
	const compact = sessionId.replaceAll("-", "");

	return /^[0-9a-f]{12}7[0-9a-f]{19}$/i.test(compact)
		? Number.parseInt(compact.slice(0, 12), 16)
		: null;
}

export async function codexTranscript(sessionId: string, sessionsDir: string) {
	const startedAtMs = codexSessionStartedAt(sessionId);
	if (startedAtMs !== null) {
		const startedAt = new Date(startedAtMs);
		const day = join(
			sessionsDir,
			String(startedAt.getFullYear()),
			String(startedAt.getMonth() + 1).padStart(2, "0"),
			String(startedAt.getDate()).padStart(2, "0"),
		);
		const exact = await Array.fromAsync(
			new Bun.Glob(`rollout-*-${sessionId}.jsonl`).scan({ cwd: day, absolute: true }),
		).catch(() => []);
		if (exact[0]) {
			return exact[0];
		}
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

export function transcriptCli(agent: string): TranscriptCli | null {
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

	const opencode = cli === "opencode" || cli === "opencode2";

	if (agent.sessionPath && !opencode && (await Bun.file(agent.sessionPath).exists())) {
		return { cli, path: agent.sessionPath };
	}

	if (!agent.sessionId || !SESSION_ID_PATTERN.test(agent.sessionId)) {
		return null;
	}

	if (opencode) {
		return (await Bun.file(directories.opencodeDbPath).exists())
			? { cli, path: directories.opencodeDbPath, sessionId: agent.sessionId }
			: null;
	}

	const path =
		cli === "claude"
			? await claudeTranscript(agent.sessionId, agent.cwd, directories.claudeProjectsDir)
			: cli === "pi"
				? await piTranscript(agent.sessionId, directories.piSessionsDir ?? PI_SESSIONS_DIR)
				: await codexTranscript(agent.sessionId, directories.codexSessionsDir);

	return path && (await Bun.file(path).exists()) ? { cli, path } : null;
}
