import type { AgentSessionEvent } from "@/lib/agent-session";
import { recentTranscriptText } from "@/lib/agent-timeline";
import { createTranscriptMirror, createTranscriptParser } from "@/lib/agent-transcript";
import { translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { translateCodexTranscriptLine } from "@/lib/codex-transcript";
import { readOpencode2Digest, readOpencode2Events } from "./opencode2";
import type { CliSessionFile } from "./paths";

const READ_CHUNK_BYTES = 1_000_000;
const TAIL_BYTES = 256_000;
const DIGEST_CACHE_LIMIT = 400;

// Toda pasta de tarefa do layout v2 é `.koworker/tasks/<grupo>/<tarefa>`. É o que o agente lê, cita e
// escreve o tempo todo quando está tocando uma tarefa, então é o traço mais confiável de vínculo que
// um transcript deixa.
const TASK_FOLDER = /\.koworker\/tasks\/[A-Za-z0-9._@-]+\/[A-Za-z0-9._@-]+/g;

// Só as CLIs que gravam a conversa em linhas de arquivo. O opencode 2 grava no banco e tem leitor
// próprio.
const TRANSLATORS: Record<
	"claude" | "codex",
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

function remember(key: string, size: number, digest: CliSessionDigest) {
	cache.delete(key);
	cache.set(key, { size, digest });

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

function eventsFrom(
	cli: "claude" | "codex",
	sessionId: string,
	chunk: string,
): AgentSessionEvent[] {
	const mirror = createTranscriptMirror(sessionId);
	const parser = createTranscriptParser(TRANSLATORS[cli]);
	mirror.apply(parser.push(`${chunk}\n`));

	return mirror.list();
}

async function readPreview(file: CliSessionFile, cli: "claude" | "codex", size: number) {
	const from = Math.max(0, size - TAIL_BYTES);
	const raw = await Bun.file(file.path).slice(from, size).text();
	// A cauda começa no meio de uma linha quando o arquivo passa do pedaço lido: a primeira sai fora
	// porque não é JSON inteiro.
	const chunk = from === 0 ? raw : raw.slice(raw.indexOf("\n") + 1);

	return recentTranscriptText(eventsFrom(cli, file.sessionId, chunk));
}

// O que a lista mostra além do cabeçalho: a última fala e as tarefas que a conversa tocou. O arquivo
// de uma sessão encerrada nunca mais muda, então a resposta é guardada por caminho e revalidada pelo
// tamanho — transcript só cresce.
export async function readSessionDigest(file: CliSessionFile): Promise<CliSessionDigest> {
	// Conversa em arquivo só cresce, então o tamanho revalida. A do opencode 2 é reescrita no banco:
	// quem revalida ali é o instante da última alteração.
	const token = file.sizeBytes || file.updatedAt;
	const key = `${file.cli}:${file.sessionId}`;
	const known = cache.get(key);
	if (known?.size === token) {
		return known.digest;
	}

	const digest =
		file.cli === "opencode2"
			? readOpencode2Digest(file.sessionId)
			: await Promise.all([
					readTaskFolderPaths(file.path, file.sizeBytes).catch(() => []),
					readPreview(file, file.cli, file.sizeBytes).catch(() => null),
				]).then(([taskFolderPaths, preview]) => ({ taskFolderPaths, preview }));

	remember(key, token, digest);

	return digest;
}

// A conversa inteira, do jeito que a timeline do app lê. Não é guardada em memória: é uma leitura
// por abertura, e o que sobra dela na tela já é o suficiente.
export async function readSessionEvents(file: CliSessionFile): Promise<AgentSessionEvent[]> {
	if (file.cli === "opencode2") {
		return readOpencode2Events(file.sessionId);
	}

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
