import { watch, type FSWatcher } from "node:fs";

import type { AgentSessionEvent } from "@/lib/agent-session";
import {
	createTranscriptMirror,
	createTranscriptParser,
	type TranscriptPatch,
} from "@/lib/agent-transcript";
import { translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { translateCodexTranscriptLine } from "@/lib/codex-transcript";
import type { AgentTranscript, TranscriptCli } from "./locate";

// A cauda que entra na conversa quando alguém abre o pane. Um transcript de horas passa de dezenas
// de megabytes por causa de imagem em base64; ler só o fim é o que mantém a abertura barata.
const TAIL_BYTES = 2_000_000;
const MAX_EVENTS = 400;
// O CLI escreve linha a linha e o watcher dispara por escrita: sem espera, um turno viraria dezenas
// de publicações de um bloco cada.
const DEBOUNCE_MS = 120;
const POLL_MS = 1_000;

const TRANSLATORS: Record<TranscriptCli, (raw: unknown) => TranscriptPatch[]> = {
	claude: translateClaudeTranscriptLine,
	codex: translateCodexTranscriptLine,
};

export type TranscriptTail = {
	source: AgentTranscript;
	events: () => AgentSessionEvent[];
	close: () => void;
};

function afterFirstLine(text: string) {
	const first = text.indexOf("\n");

	return first === -1 ? "" : text.slice(first + 1);
}

async function readTail(path: string, offset: number) {
	const file = Bun.file(path);
	const size = file.size;
	// Arquivo menor que o offset é outro arquivo no mesmo caminho (sessão nova, compactação): a
	// conversa recomeça em vez de emendar o novo no fim do que já não existe.
	const from = size < offset ? 0 : offset;
	const start = Math.max(from, size - TAIL_BYTES);

	if (start === size) {
		return { size, text: "", reset: start !== offset };
	}

	const text = await file.slice(start, size).text();

	if (start === offset) {
		return { size, text, reset: false };
	}

	// Começo que não é o começo do arquivo cai no meio de uma linha, e meia linha não é JSON.
	return { size, text: start === 0 ? text : afterFirstLine(text), reset: true };
}

// Um transcript acompanhado ao vivo: carrega a cauda, entrega o que já existe e depois só o que o
// CLI acrescenta. O lote marcado com `reset` é a conversa inteira de novo, não um acréscimo.
export async function openTranscriptTail(input: {
	sessionId: string;
	source: AgentTranscript;
	onEvents: (events: AgentSessionEvent[], reset: boolean) => void;
	onError: (error: unknown) => void;
}): Promise<TranscriptTail> {
	const mirror = createTranscriptMirror(input.sessionId, MAX_EVENTS);
	const parser = createTranscriptParser(TRANSLATORS[input.source.cli]);
	let offset = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let closed = false;
	let pulling = false;
	let pending = false;

	async function pull() {
		const chunk = await readTail(input.source.path, offset);

		if (chunk.reset) {
			mirror.reset();
			parser.reset();
		}

		offset = chunk.size;
		const events = mirror.apply(parser.push(chunk.text));

		return chunk.reset ? { events: mirror.list(), reset: true } : { events, reset: false };
	}

	function schedule() {
		if (closed) {
			return;
		}
		if (pulling) {
			pending = true;

			return;
		}
		if (timer) {
			return;
		}

		timer = setTimeout(() => {
			timer = null;
			pulling = true;
			void pull()
				.then(({ events, reset }) => {
					if (!closed && (events.length > 0 || reset)) {
						input.onEvents(events, reset);
					}
				})
				.catch(input.onError)
				.finally(() => {
					pulling = false;
					if (pending && !closed) {
						pending = false;
						schedule();
					}
				});
		}, DEBOUNCE_MS);
		timer.unref();
	}

	const first = await pull();
	input.onEvents(first.events, true);

	const watcher: FSWatcher = watch(input.source.path, { persistent: false }, () => schedule());
	watcher.on("error", input.onError);
	const poll = setInterval(() => {
		if (Bun.file(input.source.path).size !== offset) {
			schedule();
		}
	}, POLL_MS);
	poll.unref();

	return {
		source: input.source,
		events: () => mirror.list(),
		close() {
			closed = true;
			pending = false;
			if (timer) {
				clearTimeout(timer);
			}

			clearInterval(poll);
			watcher.close();
		},
	};
}
