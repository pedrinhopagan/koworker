import { z } from "zod";

import { translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { translateCodexTranscriptLine } from "@/lib/codex-transcript";
import type { CliSessionFile, HistoryCli } from "./paths";

// O começo do arquivo responde tudo que a lista precisa: onde a conversa rodou, quando começou e o
// que foi pedido primeiro. No codex a primeira linha sozinha passa de 100KB (ela carrega as
// instruções base) e a primeira fala do usuário costuma vir depois de 90KB de contexto injetado,
// então o pedaço tem que ser generoso pra caber os dois.
const HEAD_BYTES = 192_000;
// Conversa que começou com muita coisa injetada (hook, skill, contexto de projeto) empurra a fala do
// usuário pra frente. Ler mais é caro pra lista inteira, mas barato pra um item só.
const DEEP_HEAD_BYTES = 768_000;

export type CliSessionHead = {
	sessionId: string;
	cwd: string | null;
	gitBranch: string | null;
	startedAt: number | null;
	title: string | null;
	// Rollout de subagente ou sessão derivada: existe no disco, mas não é uma conversa que alguém
	// abriu no terminal e nem retoma sozinha.
	root: boolean;
};

const ClaudeLineSchema = z.object({
	cwd: z.string().optional(),
	gitBranch: z.string().optional(),
	timestamp: z.string().optional(),
});

const CodexMetaSchema = z.object({
	type: z.literal("session_meta"),
	payload: z.object({
		id: z.string().optional(),
		session_id: z.string().optional(),
		cwd: z.string().optional(),
		timestamp: z.string().optional(),
		source: z.string().optional(),
		git: z.object({ branch: z.string().optional() }).optional(),
	}),
});

const cache = new Map<string, { limit: number; head: CliSessionHead }>();

function epoch(value: string | undefined) {
	if (!value) {
		return null;
	}

	const at = Date.parse(value);

	return Number.isNaN(at) ? null : at;
}

const TITLE_MAX_CHARS = 240;

// `/clear`, `/compact`, `/context`: comando seco não diz do que a conversa trata, e é com um deles
// que metade das sessões começa. O título é a primeira fala que tem assunto.
const BARE_COMMAND = /^\/[a-z0-9:_-]+$/i;

// O que o claude embrulha em torno de um comando local: eco do comando, saída dele e o aviso de que
// nada daquilo foi digitado pelo usuário. Como marcação, não como frase.
const LOCAL_COMMAND_TAGS =
	/<(command-message|command-args|command-contents|local-command-stdout|local-command-stderr|local-command-caveat)>[\s\S]*?<\/\1>/g;
const COMMAND_NAME_TAG = /<command-name>([\s\S]*?)<\/command-name>/;

function cleanTitle(text: string) {
	const command = COMMAND_NAME_TAG.exec(text)?.[1]?.trim();
	const rest = text
		.replaceAll(LOCAL_COMMAND_TAGS, "")
		.replace(COMMAND_NAME_TAG, "")
		.replaceAll(/<\/?[a-z-]+>/gi, "")
		.trim();

	return [command, rest].filter(Boolean).join(" ").trim();
}

function titleOf(raw: unknown, cli: HistoryCli) {
	const patches =
		cli === "claude" ? translateClaudeTranscriptLine(raw) : translateCodexTranscriptLine(raw);

	for (const patch of patches) {
		if (patch.type !== "append" || patch.payload.kind !== "user") {
			continue;
		}

		const text = cleanTitle(patch.payload.text);
		if (text && !BARE_COMMAND.test(text)) {
			return text.slice(0, TITLE_MAX_CHARS);
		}
	}

	return null;
}

// O pedaço lido corta no meio de uma linha: a última só entra quando o arquivo acabou antes do
// limite, senão é JSON pela metade.
function lines(chunk: string, complete: boolean) {
	const parts = chunk.split("\n");
	if (!complete) {
		parts.pop();
	}

	return parts;
}

function readClaudeHead(chunk: string, complete: boolean, sessionId: string): CliSessionHead {
	const head: CliSessionHead = {
		sessionId,
		cwd: null,
		gitBranch: null,
		startedAt: null,
		title: null,
		root: true,
	};

	for (const line of lines(chunk, complete)) {
		if (!line.trim()) {
			continue;
		}

		let raw: unknown;
		try {
			raw = JSON.parse(line);
		} catch {
			continue;
		}

		const parsed = ClaudeLineSchema.safeParse(raw);
		if (parsed.success) {
			head.cwd ??= parsed.data.cwd ?? null;
			head.gitBranch ??= parsed.data.gitBranch ?? null;
			head.startedAt ??= epoch(parsed.data.timestamp);
		}

		head.title ??= titleOf(raw, "claude");

		if (head.cwd && head.title) {
			break;
		}
	}

	return head;
}

function readCodexHead(chunk: string, complete: boolean, sessionId: string): CliSessionHead {
	const head: CliSessionHead = {
		sessionId,
		cwd: null,
		gitBranch: null,
		startedAt: null,
		title: null,
		root: false,
	};

	for (const line of lines(chunk, complete)) {
		if (!line.trim()) {
			continue;
		}

		let raw: unknown;
		try {
			raw = JSON.parse(line);
		} catch {
			continue;
		}

		const meta = CodexMetaSchema.safeParse(raw);
		if (meta.success) {
			const id = meta.data.payload.id ?? meta.data.payload.session_id;
			head.cwd = meta.data.payload.cwd ?? null;
			head.gitBranch = meta.data.payload.git?.branch ?? null;
			head.startedAt = epoch(meta.data.payload.timestamp);
			// `source` só existe nas versões que marcam a origem; sem ele o rollout é aceito porque o
			// arquivo antigo não sabia se distinguir.
			head.root =
				(!id || id === sessionId) &&
				(!meta.data.payload.source || meta.data.payload.source === "cli");
			continue;
		}

		head.title ??= titleOf(raw, "codex");

		if (head.title) {
			break;
		}
	}

	return head;
}

async function read(file: CliSessionFile, limit: number): Promise<CliSessionHead> {
	const handle = Bun.file(file.path);
	const size = file.sizeBytes || handle.size;
	const end = Math.min(limit, size);
	const chunk = await handle.slice(0, end).text();
	const complete = end >= size;

	return file.cli === "claude"
		? readClaudeHead(chunk, complete, file.sessionId)
		: readCodexHead(chunk, complete, file.sessionId);
}

// O começo de um transcript nunca é reescrito, então a resposta vale enquanto o processo viver. Só a
// leitura profunda invalida a rasa, e é sempre pra melhor: mais bytes só acrescentam campo.
export async function readSessionHead(
	file: CliSessionFile,
	options: { deep?: boolean } = {},
): Promise<CliSessionHead> {
	const limit = options.deep ? DEEP_HEAD_BYTES : HEAD_BYTES;
	const known = cache.get(file.path);
	if (known && (known.limit >= limit || known.head.title)) {
		return known.head;
	}

	const head = await read(file, limit).catch(
		(): CliSessionHead => ({
			sessionId: file.sessionId,
			cwd: null,
			gitBranch: null,
			startedAt: null,
			title: null,
			root: true,
		}),
	);
	cache.set(file.path, { limit, head });

	return head;
}
