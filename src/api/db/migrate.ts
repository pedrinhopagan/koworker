import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import Database from "bun:sqlite";

import { envVariables } from "@/api/config/env";
import { normalizeEndAt } from "../helpers/event-time";
import { normalizeEntityName } from "./entity-name";

const KOWORKER_DIR = ".koworker";

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
		if (!hasColumn(cols, "hide_terminal")) {
			ensureColumn(sqlite, "projects", "hide_terminal INTEGER NOT NULL DEFAULT 0");
		}
	}

	// categories
	{
		const cols = tableInfo(sqlite, "categories");
		if (!hasColumn(cols, "display_order")) {
			ensureColumn(sqlite, "categories", "display_order INTEGER NOT NULL DEFAULT 0");
			resequenceDisplayOrder(sqlite, "categories");
		}
		if (!hasColumn(cols, "structure_slug")) {
			ensureColumn(sqlite, "categories", "structure_slug TEXT");
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

		// Alinha atalhos antigos do codex ao novo comando default (idempotente).
		sqlite.exec("UPDATE project_routes SET command = 'codex --yolo' WHERE command = 'codex'");
	}

	// tasks: agrupamento e ordem manual. A tabela task_groups é criada pelo constructor do
	// @lobomfz/db (CREATE TABLE IF NOT EXISTS); aqui só garantimos as colunas novas em tasks
	// nos bancos já existentes. ALTER do SQLite não anexa a FK, mas a referência só é exigida
	// em bancos novos (via CREATE TABLE) — o comportamento "SET NULL" cobre só os recém-criados.
	{
		const cols = tableInfo(sqlite, "tasks");
		if (!hasColumn(cols, "group_id")) {
			ensureColumn(sqlite, "tasks", "group_id TEXT");
		}
		if (!hasColumn(cols, "display_order")) {
			ensureColumn(sqlite, "tasks", "display_order INTEGER NOT NULL DEFAULT 0");
		}
		if (!hasColumn(cols, "file_order")) {
			ensureColumn(sqlite, "tasks", "file_order TEXT");
		}
		if (!hasColumn(cols, "complexity")) {
			// Migração: tasks existentes viram "medio" (o DEFAULT preenche as linhas atuais).
			ensureColumn(sqlite, "tasks", "complexity TEXT NOT NULL DEFAULT 'medio'");
		}
	}

	// tasks.priority_id / tasks.category_id: eram NOT NULL (toda task tinha prioridade e categoria).
	// Agora são opcionais — a task pode existir sem nenhuma das duas. SQLite não solta o NOT NULL via
	// ALTER, então rebuild da tabela preservando dados e definição (FKs, defaults), derivando o CREATE
	// do próprio sqlite_master pra não duplicar o schema. Mesmo precedente do NOT NULL do title.
	// Idempotente: só roda enquanto uma das colunas ainda estiver NOT NULL.
	{
		const cols = tableInfo(sqlite, "tasks");
		const priorityCol = cols.find((c) => c.name === "priority_id");
		const categoryCol = cols.find((c) => c.name === "category_id");
		const createSql = sqlite
			.query<{ sql: string }, []>(
				"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tasks'",
			)
			.get()?.sql;

		if ((priorityCol?.notnull === 1 || categoryCol?.notnull === 1) && createSql) {
			const newCreateSql = createSql
				.replace(/CREATE TABLE "?tasks"?/, 'CREATE TABLE "tasks_new"')
				.replace(/("priority_id"\s+TEXT)\s+NOT NULL/, "$1")
				.replace(/("category_id"\s+TEXT)\s+NOT NULL/, "$1");
			const colNames = cols.map((c) => `"${c.name}"`).join(", ");

			sqlite.exec("PRAGMA foreign_keys=OFF");
			sqlite.transaction(() => {
				sqlite.exec(newCreateSql);
				sqlite.exec(`INSERT INTO tasks_new (${colNames}) SELECT ${colNames} FROM tasks`);
				sqlite.exec("DROP TABLE tasks");
				sqlite.exec("ALTER TABLE tasks_new RENAME TO tasks");
			})();
			sqlite.exec("PRAGMA foreign_keys=ON");
		}
	}

	// tasks: a pasta da task agora é só o id curto (".koworker/<id8>"), sem slug do título.
	// Canoniza o folder_path antigo (".koworker/<id8>-<slug>") e renomeia a pasta no disco
	// quando ela ainda estiver no nome antigo. Idempotente e tolerante a pastas já renomeadas
	// à mão (aí só o folder_path do banco é atualizado).
	{
		const tasks = sqlite
			.query<{ id: string; project_id: string; folder_path: string }, []>(
				"SELECT id, project_id, folder_path FROM tasks",
			)
			.all();
		const mainRouteByProject = new Map(
			sqlite
				.query<{ id: string; main_route: string }, []>("SELECT id, main_route FROM projects")
				.all()
				.map((project) => [project.id, project.main_route] as const),
		);
		const updateFolderPath = sqlite.query("UPDATE tasks SET folder_path = ? WHERE id = ?");

		for (const task of tasks) {
			const canonical = join(KOWORKER_DIR, task.id.slice(0, 8));
			if (task.folder_path === canonical) continue;

			const mainRoute = mainRouteByProject.get(task.project_id);
			if (mainRoute) {
				const oldDir = join(mainRoute, task.folder_path);
				const newDir = join(mainRoute, canonical);
				if (existsSync(oldDir) && !existsSync(newDir)) {
					renameSync(oldDir, newDir);
				}
			}

			updateFolderPath.run(canonical, task.id);
		}
	}

	// tasks.title: era NOT NULL (título obrigatório, em sync com o H1 do index.md). Agora é
	// nullable — a task pode existir sem nome e cai no fallback do primeiro .md. SQLite não
	// solta o NOT NULL via ALTER, então rebuild da tabela preservando dados e definição (FKs,
	// defaults), derivando o CREATE do próprio sqlite_master pra não duplicar o schema.
	// Idempotente: só roda enquanto a coluna ainda estiver NOT NULL.
	{
		const titleCol = tableInfo(sqlite, "tasks").find((c) => c.name === "title");
		const createSql = sqlite
			.query<{ sql: string }, []>(
				"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tasks'",
			)
			.get()?.sql;

		if (titleCol?.notnull === 1 && createSql) {
			const newCreateSql = createSql
				.replace(/CREATE TABLE "?tasks"?/, 'CREATE TABLE "tasks_new"')
				.replace(/("title"\s+TEXT)\s+NOT NULL/, "$1");
			const cols = tableInfo(sqlite, "tasks")
				.map((c) => `"${c.name}"`)
				.join(", ");

			sqlite.exec("PRAGMA foreign_keys=OFF");
			sqlite.transaction(() => {
				sqlite.exec(newCreateSql);
				sqlite.exec(`INSERT INTO tasks_new (${cols}) SELECT ${cols} FROM tasks`);
				sqlite.exec("DROP TABLE tasks");
				sqlite.exec("ALTER TABLE tasks_new RENAME TO tasks");
			})();
			sqlite.exec("PRAGMA foreign_keys=ON");
		}
	}

	// events: o agendamento sai das tasks (scheduled_date/scheduled_time) e passa para a tabela
	// `events`, fonte única do tempo. A tabela `events` já foi criada pelo constructor do
	// @lobomfz/db (CREATE TABLE IF NOT EXISTS) no boot. Três passos em ordem NÃO-negociável:
	// (1) migrar linhas, (2) verificar por contagem, (3) só então dropar as colunas. Gated em
	// hasColumn — só roda enquanto as colunas existirem; idempotente.
	{
		const taskCols = tableInfo(sqlite, "tasks");
		if (hasColumn(taskCols, "scheduled_date")) {
			// 1. Migrar: cada task agendada vira 1 event ligado. Com horário → timed (+30min de
			//    duração default, nunca duração zero). Sem horário → all-day (end exclusivo no dia
			//    seguinte). Idempotente: pula tasks que já têm event.
			const scheduled = sqlite
				.query<{ id: string; scheduled_date: string; scheduled_time: string | null }, []>(
					"SELECT id, scheduled_date, scheduled_time FROM tasks WHERE scheduled_date IS NOT NULL AND deleted_at IS NULL",
				)
				.all();

			const hasEventForTask = sqlite.query<{ c: number }, [string]>(
				"SELECT COUNT(*) c FROM events WHERE task_id = ?",
			);
			const insertEvent = sqlite.query(
				"INSERT INTO events (id, start_at, end_at, all_day, task_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			);

			for (const task of scheduled) {
				if ((hasEventForTask.get(task.id)?.c ?? 0) > 0) continue;

				const id = crypto.randomUUID();
				const now = Date.now();
				const allDay = !task.scheduled_time;
				const startAt = allDay
					? `${task.scheduled_date}T00:00`
					: `${task.scheduled_date}T${task.scheduled_time}`;
				const endAt = normalizeEndAt({ startAt, endAt: null, allDay });

				insertEvent.run(id, startAt, endAt, allDay ? 1 : 0, task.id, now);
			}

			// 2. Verificar por contagem (read-back). Se algo ficou para trás, ABORTAR antes do drop.
			const expected =
				sqlite
					.query<{ c: number }, []>(
						"SELECT COUNT(*) c FROM tasks WHERE scheduled_date IS NOT NULL AND deleted_at IS NULL",
					)
					.get()?.c ?? 0;
			const got =
				sqlite
					.query<{ c: number }, []>(
						"SELECT COUNT(DISTINCT task_id) c FROM events WHERE task_id IS NOT NULL",
					)
					.get()?.c ?? 0;

			if (got < expected) {
				throw new Error(
					`Migração agenda→events incompleta: esperado ${expected}, obtido ${got}. Abortando antes de dropar colunas.`,
				);
			}

			// 3. Drop das colunas (só após verificação). SQLite 3.35+ tem ALTER TABLE DROP COLUMN;
			//    scheduled_date/scheduled_time não são chave nem FK, então DROP é seguro e direto —
			//    sem o rebuild-via-sqlite_master que o title exigia (lá era para tirar um NOT NULL).
			sqlite.exec("ALTER TABLE tasks DROP COLUMN scheduled_date");
			sqlite.exec("ALTER TABLE tasks DROP COLUMN scheduled_time");
		}
	}

	// skill_settings.category_id: a tabela skill_categories é criada pelo constructor do
	// @lobomfz/db (CREATE TABLE IF NOT EXISTS) no boot; aqui só garantimos a coluna nova em
	// skill_settings nos bancos já existentes. ALTER do SQLite não anexa a FK, mas a referência
	// só é exigida em bancos novos (via CREATE TABLE) — "SET NULL" cobre só os recém-criados.
	{
		const cols = tableInfo(sqlite, "skill_settings");
		if (!hasColumn(cols, "category_id")) {
			ensureColumn(sqlite, "skill_settings", "category_id TEXT");
		}
		if (!hasColumn(cols, "quick_invoke")) {
			ensureColumn(sqlite, "skill_settings", "quick_invoke INTEGER NOT NULL DEFAULT 0");
			// Semente única (roda só quando a coluna nasce): as ações que rodam sozinhas já entram
			// marcadas pro picker de invocação rápida. Depois é tudo escolha do usuário no toggle.
			const seed = sqlite.query(
				"INSERT INTO skill_settings (slug, quick_invoke, created_at) VALUES (?, 1, ?) ON CONFLICT(slug) DO UPDATE SET quick_invoke = 1",
			);
			const now = Date.now();
			for (const slug of ["grill-me", "to-plan", "commit", "pr"]) {
				seed.run(slug, now);
			}
		}
	}

	// agent_source_paths / skill_source_paths: os roots default de agents/skills deixaram de ser
	// constantes no código e viraram linhas semeadas (scope 'global'); os cadastrados pelo usuário
	// ficam 'custom'. A coluna nova em bancos já existentes nasce 'custom' (todas as linhas antigas
	// eram cadastradas à mão). ALTER do SQLite não anexa default a linhas futuras via CREATE, mas o
	// DEFAULT cobre inserts que omitem a coluna. A semente em si roda no boot do backend
	// (ensureDefaultSettings), não aqui.
	for (const table of ["agent_source_paths", "skill_source_paths"]) {
		if (!hasColumn(tableInfo(sqlite, table), "scope")) {
			ensureColumn(sqlite, table, "scope TEXT NOT NULL DEFAULT 'custom'");
		}
	}

	sqlite.close();
}
