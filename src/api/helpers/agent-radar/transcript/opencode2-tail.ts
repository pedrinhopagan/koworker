import { Database } from "bun:sqlite";

import type { AgentTranscript } from "@/api/schemas/agent-radar-transcript";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { createTranscriptMirror } from "@/lib/agent-transcript";
import {
	createOpencode2TranscriptTranslator,
	type Opencode2MessageRow,
} from "@/lib/opencode2-transcript";
import type { TranscriptTail } from "./tail";

// Mesmo banco e mesmo passo do leitor do opencode 1. O que muda é a tabela: o 2 guarda a mensagem
// inteira numa linha de `session_message` e a reescreve enquanto responde, em vez de acrescentar
// uma linha por pedaço em `part`.
const POLL_MS = 1_000;

type MessageQueryRow = { id: string; type: string; data: string };

export function openOpencode2Tail(input: {
	sessionId: string;
	source: AgentTranscript;
	onEvents: (events: AgentSessionEvent[], reset: boolean, model: string | null) => void;
	onError: (error: unknown) => void;
}): TranscriptTail {
	const db = new Database(input.source.path, { readonly: true });
	db.exec("PRAGMA query_only = ON");
	const translator = createOpencode2TranscriptTranslator();
	const mirror = createTranscriptMirror(input.sessionId);
	let closed = false;

	function pullRows(sessionId: string): Opencode2MessageRow[] {
		const rows = db
			.query(
				`SELECT id, type, data FROM session_message
				 WHERE session_id = ?
				 ORDER BY seq, time_created`,
			)
			.all(sessionId) as MessageQueryRow[];

		return rows.flatMap((row) => {
			try {
				return [{ id: row.id, type: row.type, data: JSON.parse(row.data) }];
			} catch {
				return [];
			}
		});
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
			const events = mirror.apply(translator.translate(pullRows(sessionId)));
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
		effort: () => null,
		close() {
			closed = true;
			clearInterval(timer);
			db.close();
		},
	};
}
