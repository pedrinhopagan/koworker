import { readdir, readFile, readlink, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import dayjs from "dayjs";
import { z } from "zod";

import { codexSessionStartedAt, codexTranscript, type TranscriptCli } from "./locate";

const SESSION_ID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/;
const PI_SESSION_ID = /_([0-9a-zA-Z-]+)\.jsonl$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// O `source` da sessão principal é texto (`cli` até o 0.156, `vscode` a partir do 0.157); subagente
// traz um objeto. O `originator` separa o TUI do Claude Code, do Desktop e do `codex exec`, que gravam
// no mesmo diretório e também podem declarar `vscode`.
const CodexSessionMetaSchema = z.object({
	type: z.literal("session_meta"),
	payload: z.object({
		id: z.string(),
		source: z.unknown(),
		cwd: z.string().optional(),
		originator: z.string().optional(),
	}),
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

	if (agent === "codex" && path.includes("/sessions/") && basename(path).startsWith("rollout-")) {
		return { cli: "codex" as const, path, sessionId };
	}

	if (agent === "claude" && path.includes("/.claude/projects/")) {
		return { cli: "claude" as const, path, sessionId };
	}

	return null;
}

// A primeira linha de um rollout do codex nunca muda, e essa pergunta se repete a cada releitura do
// pane enquanto alguém acompanha a conversa: a resposta fica guardada por caminho.
const codexSessionMetas = new Map<
	string,
	z.infer<typeof CodexSessionMetaSchema>["payload"] | null
>();

async function codexSessionMeta(path: string) {
	if (codexSessionMetas.has(path)) {
		return codexSessionMetas.get(path) ?? null;
	}

	const firstLine = (
		await Bun.file(path)
			.slice(0, 1_000_000)
			.text()
			.catch(() => "")
	).split("\n", 1)[0];
	if (!firstLine?.endsWith("}")) {
		return null;
	}

	const meta = await Promise.try(
		() => CodexSessionMetaSchema.parse(JSON.parse(firstLine)).payload,
	).catch(() => null);
	codexSessionMetas.set(path, meta);

	return meta;
}

async function isCodexRootSession(path: string, sessionId: string) {
	const meta = await codexSessionMeta(path);

	return meta?.id === sessionId && typeof meta.source === "string";
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

export function piSessionDir(cwd: string, root = join(homedir(), ".pi", "agent", "sessions")) {
	return join(root, `--${cwd.replace(/^[/\\]/, "").replaceAll(/[/\\:]/g, "-")}--`);
}

function flagValue(args: string[], flag: string) {
	const index = args.indexOf(flag);
	if (index !== -1) {
		return args[index + 1];
	}

	return args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

async function processStartedAt(pid: number, procRoot: string) {
	const raw = await readFile(join(procRoot, String(pid), "stat"), "utf8").catch(() => "");
	const boot = await readFile(join(procRoot, "stat"), "utf8").catch(() => "");
	const ticks = Number(
		raw
			.slice(raw.lastIndexOf(")") + 1)
			.trim()
			.split(/\s+/)[19],
	);
	const bootSeconds = Number(/^btime (\d+)$/m.exec(boot)?.[1]);

	return Number.isFinite(ticks) && Number.isFinite(bootSeconds)
		? bootSeconds * 1000 + ticks * 10
		: 0;
}

async function resolvePiSession(input: { pid: number; procRoot: string; piSessionsRoot: string }) {
	const root = join(input.procRoot, String(input.pid));
	const args = (await readFile(join(root, "cmdline"), "utf8").catch(() => ""))
		.split("\0")
		.filter(Boolean);
	const cwd = await readlink(join(root, "cwd")).catch(() => null);
	if (args.includes("--no-session") || !cwd) {
		return null;
	}

	const explicit = flagValue(args, "--session");
	if (explicit?.endsWith(".jsonl")) {
		const path = resolve(cwd, explicit);

		return (await Bun.file(path).exists()) ? path : null;
	}

	const directory = resolve(
		cwd,
		flagValue(args, "--session-dir") ?? piSessionDir(cwd, input.piSessionsRoot),
	);
	const names = (await readdir(directory).catch(() => [])).filter((name) =>
		name.endsWith(".jsonl"),
	);
	const id = flagValue(args, "--session-id") ?? explicit;
	if (id) {
		const match = names.find((name) => name.includes(id));

		return match ? join(directory, match) : null;
	}

	const startedAt = await processStartedAt(input.pid, input.procRoot);
	const recent = await Promise.all(
		names.map(async (name) => ({
			path: join(directory, name),
			modifiedAt: (await stat(join(directory, name)).catch(() => null))?.mtimeMs ?? 0,
		})),
	);

	return (
		recent
			.filter((file) => file.modifiedAt >= startedAt)
			.toSorted((left, right) => right.modifiedAt - left.modifiedAt)[0]?.path ?? null
	);
}

// Do 0.157 em diante o TUI do codex não segura o rollout aberto: quem grava é um app-server
// compartilhado fora do grupo do pane, então o descritor não aponta mais a sessão. O id vem do que
// o terminal reportou, do `resume <id>` na linha de comando ou, numa sessão nova, do rollout do TUI
// que nasceu no mesmo diretório depois do processo, sempre sob o CODEX_HOME do próprio processo.
async function resolveCodexSession(input: {
	pid: number;
	procRoot: string;
	codexHome: string;
	sessionId?: string | null;
}) {
	const root = join(input.procRoot, String(input.pid));
	const environ = (await readFile(join(root, "environ"), "utf8").catch(() => "")).split("\0");
	const sessionsDir = join(
		environ.find((entry) => entry.startsWith("CODEX_HOME="))?.slice("CODEX_HOME=".length) ||
			input.codexHome,
		"sessions",
	);
	const args = (await readFile(join(root, "cmdline"), "utf8").catch(() => ""))
		.split("\0")
		.filter(Boolean);
	const resumed = args.includes("resume") ? args.find((arg) => UUID.test(arg)) : undefined;
	const sessionId = input.sessionId ?? resumed;
	if (sessionId) {
		const path = await codexTranscript(sessionId, sessionsDir);

		return path ? { cli: "codex" as const, path, sessionId } : null;
	}

	const cwd = await readlink(join(root, "cwd")).catch(() => null);
	const startedAt = await processStartedAt(input.pid, input.procRoot);
	if (!cwd || !startedAt) {
		return null;
	}

	const days = Array.from(
		{ length: dayjs().startOf("day").diff(dayjs(startedAt).startOf("day"), "day") + 1 },
		(_, offset) => join(sessionsDir, dayjs(startedAt).add(offset, "day").format("YYYY/MM/DD")),
	);
	const born = (
		await Promise.all(
			days.map(async (day) => (await readdir(day).catch(() => [])).map((name) => join(day, name))),
		)
	)
		.flat()
		.flatMap((path) => {
			const id = SESSION_ID.exec(basename(path))?.[1];
			const bornAt = id ? codexSessionStartedAt(id) : null;

			return id && bornAt !== null && bornAt >= startedAt - 1_000 ? [{ path, id, bornAt }] : [];
		});

	// ponytail: dois TUIs do codex no mesmo diretório e CODEX_HOME, abertos juntos, podem trocar de
	// rollout aqui; num pane do kw-terminal o id reportado pelo daemon chega antes e evita o palpite.
	for (const file of born.toSorted((left, right) => right.bornAt - left.bornAt)) {
		const meta = await codexSessionMeta(file.path);
		if (
			meta &&
			meta.id === file.id &&
			meta.cwd === cwd &&
			meta.originator === "codex-tui" &&
			typeof meta.source === "string"
		) {
			return { cli: "codex" as const, path: file.path, sessionId: file.id };
		}
	}

	return null;
}

export async function resolveProcessTranscript(input: {
	agent: string;
	processIds: number[];
	procRoot?: string;
	claudeSessionsRoot?: string;
	claudeProjectsRoot?: string;
	piSessionsRoot?: string;
	codexHome?: string;
	sessionId?: string | null;
}): Promise<{ cli: TranscriptCli; path: string; sessionId: string } | null> {
	if (input.agent === "pi") {
		for (const pid of input.processIds) {
			const path = await resolvePiSession({
				pid,
				procRoot: input.procRoot ?? "/proc",
				piSessionsRoot: input.piSessionsRoot ?? join(homedir(), ".pi", "agent", "sessions"),
			});
			const sessionId = path ? PI_SESSION_ID.exec(basename(path))?.[1] : null;
			if (path && sessionId) {
				return { cli: "pi", path, sessionId };
			}
		}

		return null;
	}

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

	if (candidates.size > 1) {
		return null;
	}

	const [pid] = input.processIds;
	if (input.agent === "codex" && pid) {
		return await resolveCodexSession({
			pid,
			procRoot: input.procRoot ?? "/proc",
			codexHome: input.codexHome ?? join(homedir(), ".codex"),
			...(input.sessionId ? { sessionId: input.sessionId } : {}),
		});
	}

	if (input.agent !== "claude") {
		return null;
	}

	return await resolveClaudeSession({
		processIds: input.processIds,
		claudeSessionsRoot: input.claudeSessionsRoot ?? join(homedir(), ".claude", "sessions"),
		claudeProjectsRoot: input.claudeProjectsRoot ?? join(homedir(), ".claude", "projects"),
	});
}
