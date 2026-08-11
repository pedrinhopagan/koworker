import type { AgentSessionEvent } from "@/lib/agent-session";
import { recentTranscriptText } from "@/lib/agent-timeline";
import { createTranscriptMirror, createTranscriptParser } from "@/lib/agent-transcript";
import { translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { translateCodexTranscriptLine } from "@/lib/codex-transcript";
import type { CliSessionFile, HistoryCli } from "./paths";

const READ_CHUNK_BYTES = 1_000_000;
const TAIL_BYTES = 256_000;
const DIGEST_CACHE_LIMIT = 400;

// Toda pasta de tarefa do layout v2 é `.koworker/tasks/<grupo>/<tarefa>`. É o que o agente lê, cita e
// escreve o tempo todo quando está tocando uma tarefa, então é o traço mais confiável de vínculo que
// um transcript deixa.
const TASK_FOLDER = /\.koworker\/tasks\/[A-Za-z0-9._@-]+\/[A-Za-z0-9._@-]+/g;

const TRANSLATORS: Record<
	HistoryCli,
	(raw: unknown) => ReturnType<typeof translateClaudeTranscriptLine>
> = {
	claude: translateClaudeTranscriptLine,
	codex: translateCodexTranscriptLine,
};

export type CliSessionDigest = {
	// Cada pasta de tarefa citada na conversa e quantas vezes. A contagem é o que separa a tarefa que
	// a sessão trabalhou — lida, escrita e citada dezenas de vezes — da que passou de raspão numa
	// listagem.
	taskFolderPaths: { path: string; count: number }[];
	preview: string | null;
};

const cache = new Map<string, { size: number; digest: CliSessionDigest }>();

function remember(path: string, size: number, digest: CliSessionDigest) {
	cache.delete(path);
	cache.set(path, { size, digest });

	if (cache.size > DIGEST_CACHE_LIMIT) {
		const oldest = cache.keys().next().value;
		if (oldest) {
			cache.delete(oldest);
		}
	}
}

async function readTaskFolderPaths(path: string, size: number) {
	const file = Bun.file(path);
	const counts = new Map<string, number>();
	// A contagem é por linha inteira: pedaço cortado no meio de uma menção contaria duas vezes o que
	// aconteceu uma só, e é justamente a contagem que decide o vínculo.
	let pending = "";

	function count(text: string) {
		for (const match of text.matchAll(TASK_FOLDER)) {
			counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
		}
	}

	for (let start = 0; start < size; start += READ_CHUNK_BYTES) {
		const chunk = await file.slice(start, Math.min(start + READ_CHUNK_BYTES, size)).text();
		const lines = `${pending}${chunk}`.split("\n");
		pending = lines.pop() ?? "";

		for (const line of lines) {
			count(line);
		}
	}
	count(pending);

	return [...counts]
		.map(([folderPath, hits]) => ({ path: folderPath, count: hits }))
		.sort((left, right) => right.count - left.count);
}

function eventsFrom(cli: HistoryCli, sessionId: string, chunk: string): AgentSessionEvent[] {
	const mirror = createTranscriptMirror(sessionId);
	const parser = createTranscriptParser(TRANSLATORS[cli]);
	mirror.apply(parser.push(`${chunk}\n`));

	return mirror.list();
}

async function readPreview(file: CliSessionFile, size: number) {
	const from = Math.max(0, size - TAIL_BYTES);
	const raw = await Bun.file(file.path).slice(from, size).text();
	// A cauda começa no meio de uma linha quando o arquivo passa do pedaço lido: a primeira sai fora
	// porque não é JSON inteiro.
	const chunk = from === 0 ? raw : raw.slice(raw.indexOf("\n") + 1);

	return recentTranscriptText(eventsFrom(file.cli, file.sessionId, chunk));
}

// O que a lista mostra além do cabeçalho: a última fala e as tarefas que a conversa tocou. O arquivo
// de uma sessão encerrada nunca mais muda, então a resposta é guardada por caminho e revalidada pelo
// tamanho — transcript só cresce.
export async function readSessionDigest(file: CliSessionFile): Promise<CliSessionDigest> {
	const size = file.sizeBytes;
	const known = cache.get(file.path);
	if (known?.size === size) {
		return known.digest;
	}

	const digest = await Promise.all([
		readTaskFolderPaths(file.path, size).catch(() => []),
		readPreview(file, size).catch(() => null),
	]).then(([taskFolderPaths, preview]) => ({ taskFolderPaths, preview }));

	remember(file.path, size, digest);

	return digest;
}

// A conversa inteira, do jeito que a timeline do app lê. Não é guardada em memória: é uma leitura
// por abertura, e o que sobra dela na tela já é o suficiente.
export async function readSessionEvents(file: CliSessionFile): Promise<AgentSessionEvent[]> {
	const handle = Bun.file(file.path);
	const size = file.sizeBytes || handle.size;
	const mirror = createTranscriptMirror(file.sessionId);
	const parser = createTranscriptParser(TRANSLATORS[file.cli]);
	const decoder = new TextDecoder();

	for (let start = 0; start < size; start += READ_CHUNK_BYTES) {
		const bytes = await handle.slice(start, Math.min(start + READ_CHUNK_BYTES, size)).arrayBuffer();
		mirror.apply(parser.push(decoder.decode(bytes, { stream: true })));
	}
	mirror.apply(parser.push(decoder.decode()));

	return mirror.list();
}
