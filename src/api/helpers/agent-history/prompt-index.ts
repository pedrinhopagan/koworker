import { z } from "zod";

import { translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { createCodexTranscriptTranslator } from "@/lib/codex-transcript";
import { dbProjects } from "../../db/projects";
import { dbPrompts, type PromptRow } from "../../db/prompts";
import { matchProjectByCwd } from "../agent-radar/state";
import { mapWithConcurrency } from "../concurrency";
import {
	listClaudeSessionFiles,
	listCodexSessionFiles,
	type CliTranscriptFile,
	type FileHistoryCli,
} from "./paths";
import { extractUserPrompt, normalizePrompt } from "./prompt-text";

// Os transcripts somam gigabytes: só a linha que pode carregar fala de usuário (ou o cabeçalho do
// codex) é parseada; o resto é descartado pelo texto cru. Um transcript encerrado nunca muda, então
// o tamanho gravado em `prompt_transcripts` é o que decide se o arquivo é lido de novo.
const READ_CHUNK_BYTES = 1_000_000;
const READ_CONCURRENCY = 8;
const LINE_HINTS: Record<FileHistoryCli, string[]> = {
	claude: ['"type":"user"'],
	codex: ['"UserMessage"', '"user_message"', '"session_meta"'],
};

const LineSchema = z.object({
	timestamp: z.string().optional(),
	cwd: z.string().optional(),
	type: z.string().optional(),
	payload: z.object({ id: z.string().optional(), cwd: z.string().optional() }).optional(),
});

type Turn = { prompt: string; sentAt: number; cwd: string | null };

async function* readLines(path: string, size: number) {
	const handle = Bun.file(path);
	const decoder = new TextDecoder();
	let pending = "";

	for (let start = 0; start < size; start += READ_CHUNK_BYTES) {
		const bytes = await handle.slice(start, Math.min(start + READ_CHUNK_BYTES, size)).arrayBuffer();
		const lines = `${pending}${decoder.decode(bytes, { stream: true })}`.split("\n");
		pending = lines.pop() ?? "";
		yield* lines;
	}
	yield `${pending}${decoder.decode()}`;
}

async function extractTurns(file: CliTranscriptFile): Promise<Turn[]> {
	const translate =
		file.cli === "claude"
			? translateClaudeTranscriptLine
			: createCodexTranscriptTranslator().translate;
	const hints = LINE_HINTS[file.cli];
	const turns: Turn[] = [];
	let cwd: string | null = null;

	for await (const line of readLines(file.path, file.sizeBytes)) {
		if (!hints.some((hint) => line.includes(hint))) {
			continue;
		}

		let raw: unknown;
		try {
			raw = JSON.parse(line);
		} catch {
			continue;
		}

		const meta = LineSchema.safeParse(raw);
		if (!meta.success) {
			continue;
		}
		if (meta.data.type === "session_meta") {
			// Rollout de subagente do codex carrega o id do pai: não é uma conversa que alguém abriu.
			if (meta.data.payload?.id && meta.data.payload.id !== file.sessionId) {
				return [];
			}
			cwd = meta.data.payload?.cwd ?? cwd;
			continue;
		}
		cwd = meta.data.cwd ?? cwd;

		for (const patch of translate(raw)) {
			if (patch.type !== "append" || patch.payload.kind !== "user") {
				continue;
			}
			const prompt = extractUserPrompt(patch.payload.text);
			if (!prompt) {
				continue;
			}
			const sentAt = meta.data.timestamp ? Date.parse(meta.data.timestamp) : Number.NaN;
			turns.push({ prompt, sentAt: Number.isNaN(sentAt) ? file.updatedAt : sentAt, cwd });
		}
	}

	return turns;
}

async function indexFile(
	file: CliTranscriptFile,
	projectByCwd: (cwd: string | null) => PromptProject,
) {
	const turns = await extractTurns(file).catch((error: unknown) => {
		console.error(`Falha ao ler prompts de ${file.path}:`, error);
		return [];
	});
	const rows: PromptRow[] = turns.map((turn) => {
		const project = projectByCwd(turn.cwd);

		return {
			id: crypto.randomUUID(),
			source: file.cli,
			prompt: turn.prompt,
			norm: normalizePrompt(turn.prompt),
			session_id: file.sessionId,
			transcript_path: file.path,
			cwd: turn.cwd,
			project_id: project.project_id,
			project_name: project.project_name,
			sent_at: turn.sentAt,
			created_at: Date.now(),
		};
	});

	await dbPrompts.replaceTranscript(file, rows);
}

type PromptProject = { project_id: string | null; project_name: string | null };

async function run() {
	const files = [...listClaudeSessionFiles(), ...listCodexSessionFiles()];
	const known = await dbPrompts.transcriptSizes();
	const changed = files.filter((file) => known.get(file.path) !== file.sizeBytes);
	if (changed.length === 0) {
		return;
	}

	const projects = await dbProjects.getAll();
	const cache = new Map<string, PromptProject>();
	const projectByCwd = (cwd: string | null): PromptProject => {
		if (!cwd) {
			return { project_id: null, project_name: null };
		}
		let known = cache.get(cwd);
		if (!known) {
			const project = matchProjectByCwd(projects, cwd);
			known = { project_id: project?.id ?? null, project_name: project?.name ?? null };
			cache.set(cwd, known);
		}
		return known;
	};

	await mapWithConcurrency(changed, READ_CONCURRENCY, (file) => indexFile(file, projectByCwd));
}

let inflight: Promise<void> | null = null;

// Uma varredura por vez: quem chega enquanto ela roda espera a mesma promessa em vez de ler os
// mesmos arquivos de novo.
export function syncPromptIndex() {
	inflight ??= run().finally(() => {
		inflight = null;
	});

	return inflight;
}

// Boot: a varredura completa fica em segundo plano — o servidor não espera gigabytes de transcript
// para atender.
export function startPromptIndexer() {
	void syncPromptIndex().catch((error: unknown) => {
		console.error("Falha ao indexar prompts das CLIs:", error);
	});
}
