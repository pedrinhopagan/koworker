import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import type { RadarAgent } from "../state";

// Os dois CLIs que gravam a conversa em disco. Qualquer outro agent detectado no pane fica sem
// transcript: o radar continua mostrando o status dele, mas não há conversa para abrir.
const TRANSCRIPT_CLIS = ["claude", "codex"] as const;

export type TranscriptCli = (typeof TRANSCRIPT_CLIS)[number];

export type AgentTranscript = { cli: TranscriptCli; path: string };

// Quantos rollouts do codex chegam a ser abertos para achar o do `cwd` procurado. O arquivo certo
// costuma ser o primeiro; o teto existe para uma máquina com meses de sessões não virar leitura de
// disco a cada resolução.
const CODEX_CANDIDATES = 40;
const CODEX_META_BYTES = 64_000;

const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");
const CODEX_SESSIONS_DIR = join(homedir(), ".codex", "sessions");

const CodexSessionMetaSchema = z.object({ payload: z.object({ cwd: z.string() }) });

// O claude guarda a sessão numa pasta batizada pelo `cwd`, com todo caractere fora de letra e número
// virando hífen: `/mnt/data/Projects/koworker` vira `-mnt-data-Projects-koworker`.
export function claudeProjectSlug(cwd: string) {
	return cwd.replaceAll(/[^a-zA-Z0-9]/g, "-");
}

async function newestFirst(paths: string[]) {
	const stamped = await Promise.all(
		paths.map(async (path) => ({ path, at: (await stat(path)).mtimeMs })),
	);

	return stamped.sort((left, right) => right.at - left.at).map((entry) => entry.path);
}

async function claudeTranscript(cwd: string) {
	const dir = join(CLAUDE_PROJECTS_DIR, claudeProjectSlug(cwd));
	const entries = await readdir(dir).catch(() => []);
	const files = entries.filter((entry) => entry.endsWith(".jsonl"));

	if (files.length === 0) {
		return null;
	}

	return (await newestFirst(files.map((file) => join(dir, file))))[0] ?? null;
}

async function codexSessionCwd(path: string) {
	const head = await Bun.file(path).slice(0, CODEX_META_BYTES).text();

	try {
		const parsed = CodexSessionMetaSchema.safeParse(JSON.parse(head.split("\n")[0] ?? ""));

		return parsed.success ? parsed.data.payload.cwd : null;
	} catch {
		return null;
	}
}

// O codex não batiza a pasta pelo projeto: os rollouts vivem numa árvore por data e só a primeira
// linha do arquivo diz de qual diretório aquela sessão é. Então a busca é do mais recente para trás,
// e a ordem cronológica sai do próprio caminho (`ano/mês/dia/rollout-<timestamp>`) sem tocar o disco.
async function codexTranscript(cwd: string) {
	const files = await Array.fromAsync(
		new Bun.Glob("*/*/*/rollout-*.jsonl").scan({ cwd: CODEX_SESSIONS_DIR, absolute: true }),
	).catch(() => []);

	for (const path of files.toSorted().toReversed().slice(0, CODEX_CANDIDATES)) {
		if ((await codexSessionCwd(path)) === cwd) {
			return path;
		}
	}

	return null;
}

function transcriptCli(agent: string): TranscriptCli | null {
	return TRANSCRIPT_CLIS.find((cli) => cli === agent) ?? null;
}

// Duas fontes, nesta ordem: o caminho que o próprio CLI reportou ao kw-terminal, que é exato, e o
// casamento por `cwd` com o arquivo escrito mais recentemente ali, que cobre quem subiu sem reportar
// e erra quando há dois agents do mesmo CLI no mesmo diretório.
export async function locateAgentTranscript(
	agent: Pick<RadarAgent, "agent" | "cwd" | "sessionPath">,
): Promise<AgentTranscript | null> {
	const cli = transcriptCli(agent.agent);
	if (!cli) {
		return null;
	}

	if (agent.sessionPath) {
		return { cli, path: agent.sessionPath };
	}

	const path =
		cli === "claude" ? await claudeTranscript(agent.cwd) : await codexTranscript(agent.cwd);

	return path ? { cli, path } : null;
}
