import { readdir, readlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { z } from "zod";

import type { TranscriptCli } from "./locate";

const SESSION_ID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/;
const CodexRootSessionSchema = z.object({
	type: z.literal("session_meta"),
	payload: z.object({ id: z.string(), source: z.literal("cli") }),
});
const ClaudeProcessSessionSchema = z.object({
	pid: z.number().int().positive(),
	sessionId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
});

function transcriptFromPath(agent: string, path: string) {
	const sessionId = SESSION_ID.exec(basename(path))?.[1];
	if (!sessionId) {
		return null;
	}

	if (
		agent === "codex" &&
		path.includes("/.codex/sessions/") &&
		basename(path).startsWith("rollout-")
	) {
		return { cli: "codex" as const, path, sessionId };
	}

	if (agent === "claude" && path.includes("/.claude/projects/")) {
		return { cli: "claude" as const, path, sessionId };
	}

	return null;
}

async function isCodexRootSession(path: string, sessionId: string) {
	try {
		const firstLine = (await Bun.file(path).slice(0, 1_000_000).text()).split("\n", 1)[0];
		if (!firstLine) {
			return false;
		}

		const parsed = CodexRootSessionSchema.safeParse(JSON.parse(firstLine));

		return parsed.success && parsed.data.payload.id === sessionId;
	} catch {
		return false;
	}
}

async function resolveClaudeSession(input: {
	processIds: number[];
	claudeSessionsRoot: string;
	claudeProjectsRoot: string;
}) {
	const sessionIds = new Set<string>();

	for (const processId of input.processIds) {
		const raw = await Bun.file(join(input.claudeSessionsRoot, `${processId}.json`))
			.json()
			.catch(() => null);
		const parsed = ClaudeProcessSessionSchema.safeParse(raw);
		if (parsed.success && parsed.data.pid === processId) {
			sessionIds.add(parsed.data.sessionId);
		}
	}

	if (sessionIds.size !== 1) {
		return null;
	}

	const sessionId = sessionIds.values().next().value;
	if (!sessionId) {
		return null;
	}

	const paths = await Array.fromAsync(
		new Bun.Glob(`*/${sessionId}.jsonl`).scan({
			cwd: input.claudeProjectsRoot,
			absolute: true,
			onlyFiles: true,
		}),
	).catch(() => []);

	return paths.length === 1 ? { cli: "claude" as const, path: paths[0]!, sessionId } : null;
}

export async function resolveProcessTranscript(input: {
	agent: string;
	processIds: number[];
	procRoot?: string;
	claudeSessionsRoot?: string;
	claudeProjectsRoot?: string;
}): Promise<{ cli: TranscriptCli; path: string; sessionId: string } | null> {
	const candidates = new Map<string, { cli: TranscriptCli; path: string; sessionId: string }>();

	for (const processId of input.processIds) {
		const fdRoot = join(input.procRoot ?? "/proc", String(processId), "fd");
		const descriptors = await readdir(fdRoot).catch(() => []);

		for (const descriptor of descriptors) {
			const path = await readlink(join(fdRoot, descriptor)).catch(() => null);
			const transcript = path ? transcriptFromPath(input.agent, path) : null;
			const rootSession =
				transcript?.cli !== "codex" ||
				(await isCodexRootSession(transcript.path, transcript.sessionId));
			if (transcript && rootSession) {
				candidates.set(transcript.path, transcript);
			}
		}
	}

	if (candidates.size === 1) {
		return candidates.values().next().value ?? null;
	}

	if (candidates.size > 1 || input.agent !== "claude") {
		return null;
	}

	return await resolveClaudeSession({
		processIds: input.processIds,
		claudeSessionsRoot: input.claudeSessionsRoot ?? join(homedir(), ".claude", "sessions"),
		claudeProjectsRoot: input.claudeProjectsRoot ?? join(homedir(), ".claude", "projects"),
	});
}
