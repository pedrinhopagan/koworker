import { Database } from "bun:sqlite";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// O opencode guarda todas as conversas num banco SQLite único. Quando o pane não reporta o id da
// sessão (integração ausente ou instância aberta antes da instalação), é daqui que saímos: a sessão
// mais recente daquele diretório, ignorando subagentes e arquivadas.

export const OPENCODE_DB_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db");

export function opencodeDbExists() {
	return Bun.file(OPENCODE_DB_PATH).exists();
}

// O mesmo diretório aparece dezenas de vezes na tabela e o realpath custa syscall: sem memo, cada
// consulta do sincronizador refaria o trabalho de ontem.
const canonicalCache = new Map<string, string>();

function canonical(value: string) {
	const cached = canonicalCache.get(value);
	if (cached) {
		return cached;
	}

	let resolved = value.replace(/\/+$/, "");
	try {
		resolved = `${realpathSync(value).replace(/\/+$/, "")}`;
	} catch {
		// Caminho que não existe mais cai no texto mesmo.
	}

	if (canonicalCache.size > 500) {
		canonicalCache.clear();
	}
	canonicalCache.set(value, resolved);

	return resolved;
}

// A versão 2 do opencode guarda as conversas dela no mesmo arquivo de banco, em outra tabela: a
// `session` é do 1 e a `session_v2` é do 2. Cada uma responde só pelas suas.
export const OPENCODE_SESSION_TABLES = {
	opencode: "session",
	opencode2: "session_v2",
} as const;

export type OpencodeVariant = keyof typeof OPENCODE_SESSION_TABLES;

// A sessão viva mais recente do diretório do pane. `parent_id` marca sessão de subagente (task
// tool): adotar uma delas mostraria a conversa de um subagente no lugar da conversa real.
export function locateOpencodeSessionByDirectory(
	cwd: string,
	variant: OpencodeVariant = "opencode",
): string | null {
	if (!opencodeDbExists()) {
		return null;
	}

	const table = OPENCODE_SESSION_TABLES[variant];
	const db = new Database(OPENCODE_DB_PATH, { readonly: true });
	try {
		const exact = (
			db
				.query(
					`SELECT id FROM ${table}
					 WHERE parent_id IS NULL AND time_archived IS NULL AND directory = ?
					 ORDER BY time_updated DESC LIMIT 1`,
				)
				.get(cwd) as { id?: string } | null
		)?.id;
		if (exact) {
			return exact;
		}

		// O caminho pode ter entrado por link simbólico ou barra final: compara canônico entre as
		// sessões vivas recentes antes de desistir.
		const target = canonical(cwd);
		const rows = db
			.query(
				`SELECT id, directory FROM ${table}
				 WHERE parent_id IS NULL AND time_archived IS NULL
				 ORDER BY time_updated DESC LIMIT 200`,
			)
			.all() as { id: string; directory: string }[];

		return rows.find((row) => row.directory && canonical(row.directory) === target)?.id ?? null;
	} catch {
		return null;
	} finally {
		db.close();
	}
}
