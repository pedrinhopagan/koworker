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

const READ_CHUNK_BYTES = 1_000_000;
// O CLI escreve linha a linha e o watcher dispara por escrita: sem espera, um turno viraria dezenas
// de publicações de um bloco cada.
const DEBOUNCE_MS = 120;

const TRANSLATORS: Record<TranscriptCli, (raw: unknown) => TranscriptPatch[]> = {
	claude: translateClaudeTranscriptLine,
	codex: translateCodexTranscriptLine,
};

export type TranscriptTail = {
	source: AgentTranscript;
	events: () => AgentSessionEvent[];
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
	onEvents: (events: AgentSessionEvent[], reset: boolean) => void;
	onError: (error: unknown) => void;
}): Promise<TranscriptTail> {
	const mirror = createTranscriptMirror(input.sessionId);
	const parser = createTranscriptParser(TRANSLATORS[input.source.cli]);
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
						input.onEvents(events, reset);
					}
				})
				.catch(input.onError);
		}, DEBOUNCE_MS);
		timer.unref();
	}

	const first = await pull();
	input.onEvents(first.events, true);

	const watcher: FSWatcher = watch(input.source.path, { persistent: false }, () => schedule());
	watcher.on("error", input.onError);

	return {
		source: input.source,
		events: () => mirror.list(),
		close() {
			closed = true;
			if (timer) {
				clearTimeout(timer);
			}

			watcher.close();
		},
	};
}
