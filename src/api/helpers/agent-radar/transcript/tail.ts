import { watch, type FSWatcher } from "node:fs";

import type { AgentSessionEvent } from "@/lib/agent-session";
import {
	createTranscriptMirror,
	createTranscriptParser,
	type TranscriptPatch,
} from "@/lib/agent-transcript";
import { claudeTranscriptModel, translateClaudeTranscriptLine } from "@/lib/claude-transcript";
import { codexTranscriptModel, translateCodexTranscriptLine } from "@/lib/codex-transcript";
import type { AgentTranscript, TranscriptCli } from "./locate";

const READ_CHUNK_BYTES = 1_000_000;
// O CLI escreve linha a linha e o watcher dispara por escrita: sem espera, um turno viraria dezenas
// de publicações de um bloco cada.
const DEBOUNCE_MS = 120;
// `fs.watch` depende do FS emitir eventos; em rede ou container isso falha em silêncio e a conversa
// congela. O relógio confere o tamanho do arquivo e custa um stat por segundo, só enquanto há leitor.
const POLL_MS = 1_000;

const TRANSLATORS: Record<TranscriptCli, (raw: unknown) => TranscriptPatch[]> = {
	claude: translateClaudeTranscriptLine,
	codex: translateCodexTranscriptLine,
};

const MODEL_EXTRACTORS: Record<TranscriptCli, (raw: unknown) => string | null> = {
	claude: claudeTranscriptModel,
	codex: codexTranscriptModel,
};

export type TranscriptTail = {
	source: AgentTranscript;
	events: () => AgentSessionEvent[];
	model: () => string | null;
	close: () => void;
};

async function readTranscript(input: {
	path: string;
	offset: number;
	onReset: () => void;
	push: (chunk: string) => void;
}) {
	const file = Bun.file(input.path);
	const size = file.size;
	const reset = size < input.offset;
	const from = reset ? 0 : input.offset;
	const decoder = new TextDecoder();
	if (reset) {
		input.onReset();
	}

	for (let start = from; start < size; start += READ_CHUNK_BYTES) {
		const bytes = await file.slice(start, Math.min(start + READ_CHUNK_BYTES, size)).arrayBuffer();
		input.push(decoder.decode(bytes, { stream: true }));
	}
	input.push(decoder.decode());

	return { size, reset };
}

export async function openTranscriptTail(input: {
	sessionId: string;
	source: AgentTranscript;
	onEvents: (events: AgentSessionEvent[], reset: boolean, model: string | null) => void;
	onError: (error: unknown) => void;
}): Promise<TranscriptTail> {
	const mirror = createTranscriptMirror(input.sessionId);
	const translate = TRANSLATORS[input.source.cli];
	const extractModel = MODEL_EXTRACTORS[input.source.cli];
	let model: string | null = null;
	const parser = createTranscriptParser((raw) => {
		model = extractModel(raw) ?? model;

		return translate(raw);
	});
	let offset = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let closed = false;

	async function pull() {
		const events: AgentSessionEvent[] = [];
		const read = await readTranscript({
			path: input.source.path,
			offset,
			onReset: () => {
				mirror.reset();
				parser.reset();
				model = null;
			},
			push: (chunk) => events.push(...mirror.apply(parser.push(chunk))),
		});
		offset = read.size;

		return read.reset ? { events: mirror.list(), reset: true } : { events, reset: false };
	}

	function schedule() {
		if (timer || closed) {
			return;
		}

		timer = setTimeout(() => {
			timer = null;
			void pull()
				.then(({ events, reset }) => {
					if (!closed && (events.length > 0 || reset)) {
						input.onEvents(events, reset, model);
					}
				})
				.catch(input.onError);
		}, DEBOUNCE_MS);
		timer.unref();
	}

	const first = await pull();
	input.onEvents(first.events, true, model);

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
		model: () => model,
		close() {
			closed = true;
			if (timer) {
				clearTimeout(timer);
			}

			clearInterval(poll);
			watcher.close();
		},
	};
}
