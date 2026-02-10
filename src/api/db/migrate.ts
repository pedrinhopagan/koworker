import Database from "bun:sqlite";

import { envVariables } from "@/api/config/env";
import { normalizeEntityName } from "./entity-name";

type ColumnInfo = {
	cid: number;
	name: string;
	type: string;
	notnull: 0 | 1;
	dflt_value: string | null;
	pk: number;
};

type NamedEntityRow = {
	id: string;
	name: string;
	created_at: number | null;
	display_order: number | null;
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

function deduplicateNamedEntities(
	db: Database,
	params: { table: "categories" | "priorities"; taskForeignKey: "category_id" | "priority_id" },
) {
	const rows = db
		.query<NamedEntityRow, []>(
			`SELECT id, name, created_at, display_order FROM ${params.table} ORDER BY created_at ASC, display_order ASC, id ASC`,
		)
		.all();
	const canonicalByName = new Map<string, NamedEntityRow>();

	for (const row of rows) {
		const normalizedName = normalizeEntityName(row.name);
		if (!normalizedName) continue;

		const canonical = canonicalByName.get(normalizedName);
		if (!canonical) {
			canonicalByName.set(normalizedName, row);
			continue;
		}

		if (canonical.id === row.id) continue;

		db.query(
			`UPDATE tasks SET ${params.taskForeignKey} = ? WHERE ${params.taskForeignKey} = ?`,
		).run(canonical.id, row.id);
		db.query(`DELETE FROM ${params.table} WHERE id = ?`).run(row.id);
	}

	resequenceDisplayOrder(db, params.table);
}

/**
 * Lightweight schema migration to keep local sqlite DB compatible with the current code.
 *
 * This is intentionally idempotent.
 */
export function ensureDbSchema() {
	const dbPath = envVariables.DATABASE_URL;
	const sqlite = new Database(dbPath);
	sqlite.run("PRAGMA journal_mode = WAL");
	sqlite.run("PRAGMA busy_timeout = 5000");

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

		deduplicateNamedEntities(sqlite, {
			table: "categories",
			taskForeignKey: "category_id",
		});
		sqlite.exec(
			"CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_idx ON categories (lower(trim(name)))",
		);
	}

	// priorities
	{
		const cols = tableInfo(sqlite, "priorities");
		if (!hasColumn(cols, "level")) {
			ensureColumn(sqlite, "priorities", "level INTEGER NOT NULL DEFAULT 1");
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

		deduplicateNamedEntities(sqlite, {
			table: "priorities",
			taskForeignKey: "priority_id",
		});
		sqlite.exec(
			"CREATE UNIQUE INDEX IF NOT EXISTS priorities_name_unique_idx ON priorities (lower(trim(name)))",
		);
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

	// skills
	{
		const cols = tableInfo(sqlite, "skills");
		if (!hasColumn(cols, "display_order")) {
			ensureColumn(sqlite, "skills", "display_order INTEGER NOT NULL DEFAULT 0");
			resequenceDisplayOrder(sqlite, "skills", "source = 'builtin'");
			resequenceDisplayOrder(sqlite, "skills", "source = 'custom'");
		}
	}

	// subtasks
	{
		const cols = tableInfo(sqlite, "subtasks");
		if (!hasColumn(cols, "display_order")) {
			ensureColumn(sqlite, "subtasks", "display_order INTEGER NOT NULL DEFAULT 0");
			const tasks = sqlite.query("SELECT DISTINCT task_id FROM subtasks").all();
			for (const task of tasks as { task_id: string }[]) {
				resequenceDisplayOrder(sqlite, "subtasks", `task_id = '${task.task_id}'`);
			}
		}
	}

	// tasks
	{
		const cols = tableInfo(sqlite, "tasks");
		if (!hasColumn(cols, "scheduled_time")) {
			ensureColumn(sqlite, "tasks", "scheduled_time TEXT");
		}
	}

	sqlite.close();
}
