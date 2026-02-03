import Database from "bun:sqlite";

import { envVariables } from "@/api/config/env";

type ColumnInfo = {
	cid: number;
	name: string;
	type: string;
	notnull: 0 | 1;
	dflt_value: string | null;
	pk: number;
};

function hasColumn(columns: ColumnInfo[], columnName: string) {
	return columns.some((c) => c.name === columnName);
}

function tableInfo(db: Database, table: string): ColumnInfo[] {
	return db.query<ColumnInfo, []>(`PRAGMA table_info(${table})`).all();
}

function ensureColumn(db: Database, table: string, columnDef: string) {
	// columnDef includes column name, type, default, etc.
	db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
}

function resequenceDisplayOrder(db: Database, table: string, whereClause = "1=1") {
	// SQLite supports window functions.
	db.exec(`
WITH ordered AS (
	SELECT id, (row_number() OVER (ORDER BY created_at)) - 1 AS ord
	FROM ${table}
	WHERE ${whereClause}
)
UPDATE ${table}
SET display_order = (SELECT ord FROM ordered WHERE ordered.id = ${table}.id)
WHERE id IN (SELECT id FROM ordered);
`);
}

/**
 * Lightweight schema migration to keep local sqlite DB compatible with the current code.
 *
 * This is intentionally idempotent.
 */
export function ensureDbSchema() {
	const dbPath = envVariables.DATABASE_URL;
	const sqlite = new Database(dbPath);

	// projects
	{
		const cols = tableInfo(sqlite, "projects");
		if (!hasColumn(cols, "display_order")) {
			ensureColumn(sqlite, "projects", "display_order INTEGER NOT NULL DEFAULT 0");
			resequenceDisplayOrder(sqlite, "projects", "deleted_at IS NULL");
		}
	}

	// categories
	{
		const cols = tableInfo(sqlite, "categories");
		if (!hasColumn(cols, "display_order")) {
			ensureColumn(sqlite, "categories", "display_order INTEGER NOT NULL DEFAULT 0");
			resequenceDisplayOrder(sqlite, "categories");
		}
	}

	// priorities
	{
		const cols = tableInfo(sqlite, "priorities");
		if (!hasColumn(cols, "level")) {
			ensureColumn(sqlite, "priorities", "level INTEGER NOT NULL DEFAULT 1");
			// Best-effort backfill based on common PT-BR names.
			sqlite.exec(`
UPDATE priorities SET level = 3 WHERE lower(name) = 'alta';
UPDATE priorities SET level = 2 WHERE lower(name) = 'media' OR lower(name) = 'média';
UPDATE priorities SET level = 1 WHERE lower(name) = 'baixa';
`);
		}
		if (!hasColumn(cols, "display_order")) {
			ensureColumn(sqlite, "priorities", "display_order INTEGER NOT NULL DEFAULT 0");
			resequenceDisplayOrder(sqlite, "priorities");
		}
	}

	// project_routes
	{
		const cols = tableInfo(sqlite, "project_routes");
		if (!hasColumn(cols, "icon")) {
			ensureColumn(sqlite, "project_routes", "icon TEXT");
		}
		if (!hasColumn(cols, "command")) {
			ensureColumn(sqlite, "project_routes", "command TEXT");
		}
		if (!hasColumn(cols, "display_order")) {
			ensureColumn(sqlite, "project_routes", "display_order INTEGER NOT NULL DEFAULT 0");
			// Resequenciar por projeto
			const projects = sqlite.query("SELECT DISTINCT project_id FROM project_routes").all();
			for (const project of projects as { project_id: string }[]) {
				resequenceDisplayOrder(sqlite, "project_routes", `project_id = '${project.project_id}'`);
			}
		}
	}

	sqlite.close();
}
