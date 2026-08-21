import { Database } from "bun:sqlite";

import type { AgentSessionEvent } from "@/lib/agent-session";
import {
	createOpencodeTranscriptTranslator,
	type OpencodePartRow,
} from "@/lib/opencode-transcript";
import { createTranscriptMirror } from "@/lib/agent-transcript";
import type { AgentTranscript } from "./locate";
import type { TranscriptTail } from "./tail";

// O opencode escreve no banco enquanto conversa, e o SQLite em WAL aceita leitor ao lado do escritor.
// Um segundo é o mesmo passo do fallback dos arquivos: basta para acompanhar sem custar bateria.
const POLL_MS = 1_000;

type PartQueryRow = {
	id: string;
	message_id: string;
	role: string;
	part_data: string;
	model_id: string | null;
};

export function openOpencodeTail(input: {
	sessionId: string;
	source: AgentTranscript;
	onEvents: (events: AgentSessionEvent[], reset: boolean, model: string | null) => void;
	onError: (error: unknown) => void;
}): TranscriptTail {
	const db = new Database(input.source.path, { readonly: true });
	db.exec("PRAGMA query_only = ON");
	const translator = createOpencodeTranscriptTranslator();
	const mirror = createTranscriptMirror(input.sessionId);
	let closed = false;

	function pullRows(sessionId: string): PartQueryRow[] {
		return db
			.query(
				`SELECT p.id, p.message_id, p.data AS part_data,
				        json_extract(m.data, '$.modelID') AS model_id,
				        json_extract(m.data, '$.role') AS role
				 FROM part p
				 JOIN message m ON m.id = p.message_id
				 WHERE p.session_id = ?
				 ORDER BY m.time_created, p.rowid`,
			)
			.all(sessionId) as PartQueryRow[];
	}

	function toPartRows(rows: PartQueryRow[]): OpencodePartRow[] {
		return rows.map((row) => ({
			id: row.id,
			messageId: row.message_id,
			role: row.role ?? "",
			data: JSON.parse(row.part_data),
		}));
	}

	function poll(first: boolean) {
		if (closed) {
			return;
		}

		const sessionId = input.source.sessionId;
		if (!sessionId) {
			return;
		}

		try {
			const rows = pullRows(sessionId);
			for (const row of rows) {
				translator.observeModel(row.model_id);
			}

			const events = mirror.apply(translator.translate(toPartRows(rows)));
			if (first) {
				input.onEvents(mirror.list(), true, translator.model());
			} else if (events.length > 0) {
				input.onEvents(events, false, translator.model());
			}
		} catch (error) {
			input.onError(error);
		}
	}

	poll(true);
	const timer = setInterval(() => poll(false), POLL_MS);
	timer.unref();

	return {
		source: input.source,
		events: () => mirror.list(),
		model: () => translator.model(),
		close() {
			closed = true;
			clearInterval(timer);
			db.close();
		},
	};
}
