import { Database } from "bun:sqlite";

import type { AgentSessionEvent } from "@/lib/agent-session";
import { recentTranscriptText } from "@/lib/agent-timeline";
import { createTranscriptMirror } from "@/lib/agent-transcript";
import {
	createOpencode2TranscriptTranslator,
	type Opencode2MessageRow,
} from "@/lib/opencode2-transcript";
import { OPENCODE_DB_PATH, opencodeDbExists } from "../opencode-db";
import type { CliSessionDigest } from "./digest";
import type { CliSessionHead } from "./head";
import type { CliSessionFile } from "./paths";

// O histórico do claude e do codex é um arquivo por conversa; o do opencode 2 são linhas de
// `session_v2` e `session_message` no banco que as duas versões dividem. Este arquivo é a ponta que
// devolve, dessas tabelas, o mesmo formato que o resto do histórico já sabe ler.

// Conversa antiga não interessa à lista e varrer o banco inteiro custa: o teto é generoso o bastante
// para cobrir meses de uso e ainda assim ler em milissegundos.
const SESSION_LIMIT = 500;

// Toda pasta de tarefa do layout v2. Mesmo traço que o digest dos arquivos procura.
const TASK_FOLDER = /\.koworker\/tasks\/[A-Za-z0-9._@-]+\/[A-Za-z0-9._@-]+/g;

type SessionRow = {
	id: string;
	directory: string | null;
	title: string | null;
	time_created: number | null;
	time_updated: number | null;
};

function open() {
	if (!opencodeDbExists()) {
		return null;
	}

	try {
		const db = new Database(OPENCODE_DB_PATH, { readonly: true });
		db.exec("PRAGMA query_only = ON");

		return db;
	} catch {
		return null;
	}
}

function query<T>(run: (db: Database) => T, fallback: T): T {
	const db = open();
	if (!db) {
		return fallback;
	}

	try {
		return run(db);
	} catch {
		return fallback;
	} finally {
		db.close();
	}
}

// As conversas raiz que podem ser deste projeto. `parent_id` marca subagente e `time_archived`
// marca arquivada: nenhuma das duas é conversa que alguém abriu no terminal.
export function listOpencode2SessionFiles(mainRoutes?: string[]): CliSessionFile[] {
	const rows = query<SessionRow[]>(
		(db) =>
			db
				.query(
					`SELECT id, directory, title, time_created, time_updated FROM session_v2
					 WHERE parent_id IS NULL AND time_archived IS NULL
					 ORDER BY time_updated DESC LIMIT ${SESSION_LIMIT}`,
				)
				.all() as SessionRow[],
		[],
	);

	return rows.flatMap((row) => {
		if (mainRoutes?.length && !mainRoutes.some((root) => inside(row.directory, root))) {
			return [];
		}

		return [
			{
				cli: "opencode2" as const,
				sessionId: row.id,
				path: OPENCODE_DB_PATH,
				updatedAt: row.time_updated ?? row.time_created ?? 0,
				// A conversa não é um arquivo: não há tamanho para revalidar cache nem para mostrar.
				sizeBytes: 0,
			},
		];
	});
}

function inside(directory: string | null, root: string) {
	if (!directory) {
		return false;
	}

	return directory === root || directory.startsWith(`${root}/`);
}

export function readOpencode2Head(sessionId: string): CliSessionHead {
	const row = query<SessionRow | null>(
		(db) =>
			(db
				.query(
					`SELECT id, directory, title, time_created, time_updated FROM session_v2 WHERE id = ?`,
				)
				.get(sessionId) as SessionRow | null) ?? null,
		null,
	);

	return {
		sessionId,
		cwd: row?.directory ?? null,
		// O opencode não guarda o branch da conversa.
		gitBranch: null,
		startedAt: row?.time_created ?? null,
		title: row?.title?.trim() || null,
		root: true,
	};
}

function messages(sessionId: string): Opencode2MessageRow[] {
	const rows = query<{ id: string; type: string; data: string }[]>(
		(db) =>
			db
				.query(
					`SELECT id, type, data FROM session_message
					 WHERE session_id = ?
					 ORDER BY seq, time_created`,
				)
				.all(sessionId) as { id: string; type: string; data: string }[],
		[],
	);

	return rows.flatMap((row) => {
		try {
			return [{ id: row.id, type: row.type, data: JSON.parse(row.data) }];
		} catch {
			return [];
		}
	});
}

export function readOpencode2Events(sessionId: string): AgentSessionEvent[] {
	const mirror = createTranscriptMirror(sessionId);
	mirror.apply(createOpencode2TranscriptTranslator().translate(messages(sessionId)));

	return mirror.list();
}

export function readOpencode2Digest(sessionId: string): CliSessionDigest {
	const rows = messages(sessionId);
	const counts = new Map<string, number>();

	for (const row of rows) {
		for (const match of JSON.stringify(row.data).matchAll(TASK_FOLDER)) {
			counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
		}
	}

	const mirror = createTranscriptMirror(sessionId);
	mirror.apply(createOpencode2TranscriptTranslator().translate(rows));

	return {
		taskFolderPaths: [...counts]
			.map(([path, count]) => ({ path, count }))
			.sort((left, right) => right.count - left.count),
		preview: recentTranscriptText(mirror.list()),
	};
}
