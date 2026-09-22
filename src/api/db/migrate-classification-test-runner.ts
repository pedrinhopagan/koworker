import { readdir } from "node:fs/promises";
import { join } from "node:path";
import Database from "bun:sqlite";

const [root, phase] = process.argv.slice(2);
if (!root) {
	throw new Error("Raiz temporária não informada");
}

const databasePath = join(root, "legado.sqlite");

process.env.DATABASE_URL = databasePath;
process.env.JWT_SECRET = "classification-migrate-test-secret";
process.env.NODE_ENV = "development";

const PROJECT = "aaaaaaaa-0000-4000-8000-000000000001";
const GROUP = "11111111-0000-4000-8000-000000000001";
const TASKS = [
	"12345678-aaaa-4000-8000-000000000001",
	"12345678-bbbb-4000-8000-000000000002",
	"12345678-cccc-4000-8000-000000000003",
];

if (phase === "legado") {
	const legacy = new Database(databasePath);
	legacy.exec(`
CREATE TABLE "categories" ("color" TEXT NOT NULL DEFAULT '#000000', "created_at" INTEGER NOT NULL DEFAULT (unixepoch()), "display_order" INTEGER NOT NULL DEFAULT 0, "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "updated_at" TEXT, structure_slug TEXT);
CREATE TABLE "priorities" ("color" TEXT NOT NULL DEFAULT '#000000', "created_at" INTEGER NOT NULL DEFAULT (unixepoch()), "display_order" INTEGER NOT NULL DEFAULT 0, "id" TEXT PRIMARY KEY, "level" INTEGER NOT NULL DEFAULT 1, "name" TEXT NOT NULL, "updated_at" TEXT);
CREATE TABLE "tasks" ("category_id" TEXT, "created_at" INTEGER NOT NULL DEFAULT (unixepoch()), "done" INTEGER NOT NULL DEFAULT 0, "folder_path" TEXT NOT NULL, "id" TEXT PRIMARY KEY, "priority_id" TEXT, "project_id" TEXT NOT NULL, "title" TEXT, "completed_at" TEXT, "deleted_at" TEXT, "updated_at" TEXT, group_id TEXT, display_order INTEGER NOT NULL DEFAULT 0, file_order TEXT, complexity TEXT NOT NULL DEFAULT 'medio', merge_ready_at INTEGER, worktree_branch TEXT, merge_target_branch TEXT, worktree_path TEXT, worktree_pr_url TEXT, storage_key TEXT, storage_slug TEXT, FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT, FOREIGN KEY ("priority_id") REFERENCES "priorities"("id") ON DELETE RESTRICT, FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT);
CREATE INDEX tasks_project_id_idx ON tasks (project_id);
CREATE UNIQUE INDEX categories_name_unique_idx ON categories (lower(trim(name)));
`);
	legacy.close();
}

const { db } = await import("./connection");
const { ensureDbSchema } = await import("./migrate");

if (phase === "legado") {
	const sqlite = new Database(databasePath);
	sqlite.exec("PRAGMA foreign_keys=ON");
	sqlite.exec(`
INSERT INTO users (id, name, password, user_type) VALUES (1, 'Teste', 'x', 'user');
INSERT INTO projects (id, name, main_route, created_at) VALUES ('${PROJECT}', 'Projeto', '${join(root, "project")}', 1);
INSERT INTO task_groups (id, project_id, name, color, storage_key, storage_slug, created_at) VALUES ('${GROUP}', '${PROJECT}', 'Feature', '#6366f1', 'feat0001', 'feature', 1);
INSERT INTO categories (id, name, structure_slug) VALUES ('cat-1', 'feature', 'feature'), ('cat-2', 'fix', 'fix');
INSERT INTO priorities (id, name, level) VALUES ('pri-1', 'Alta', 3);
INSERT INTO tasks (id, project_id, folder_path, title, category_id, priority_id, complexity, group_id, display_order, storage_key, storage_slug, created_at)
	VALUES ('${TASKS[0]}', '${PROJECT}', '.koworker/tasks/feature--feat0001/primeira--12345678', 'Primeira', 'cat-1', 'pri-1', 'alto', '${GROUP}', 0, '12345678', 'primeira', 1);
INSERT INTO tasks (id, project_id, folder_path, title, category_id, complexity, file_order, done, completed_at, created_at)
	VALUES ('${TASKS[1]}', '${PROJECT}', '.koworker/tasks/_sem-feature/segunda', 'Segunda', 'cat-2', 'medio', '["index.md"]', 1, 5, 2);
INSERT INTO tasks (id, project_id, folder_path, created_at, deleted_at)
	VALUES ('${TASKS[2]}', '${PROJECT}', '.koworker/tasks/_sem-feature/apagada', 3, 4);
INSERT INTO execution_runs (id, user_id, project_id, task_id, kind, title, status, stage, started_at, updated_at)
	VALUES ('run-flow', 1, '${PROJECT}', '${TASKS[0]}', 'flow', 'Fluxo antigo', 'done', 'plano', 1, 1);
INSERT INTO agent_sessions (id, user_id, project_id, task_id, title, cli, cwd, status, started_at, updated_at)
	VALUES ('sessao', 1, '${PROJECT}', '${TASKS[1]}', 'Conversa', 'claude', '${root}', 'ended', 1, 1);
`);
	sqlite.close();
}

ensureDbSchema();
ensureDbSchema();

if (phase !== "legado") {
	const stale = new Database(databasePath);
	stale.exec(
		`CREATE TABLE IF NOT EXISTS "categories" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL);
		 CREATE TABLE IF NOT EXISTS "priorities" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL);`,
	);
	stale.close();
	ensureDbSchema();
}

const tasks = await db
	.selectFrom("tasks")
	.select([
		"id",
		"project_id",
		"folder_path",
		"title",
		"group_id",
		"display_order",
		"file_order",
		"storage_key",
		"storage_slug",
		"done",
		"completed_at",
		"deleted_at",
	])
	.orderBy("created_at")
	.execute();
const run = await db
	.selectFrom("execution_runs")
	.select(["id", "kind", "task_id", "stage"])
	.executeTakeFirst();
const session = await db.selectFrom("agent_sessions").select(["id", "task_id"]).executeTakeFirst();
await db.destroy();

const sqlite = new Database(databasePath, { readonly: true });
const tables = sqlite
	.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
	.all()
	.map((row) => row.name);
const taskColumns = sqlite
	.query<{ name: string }, []>("PRAGMA table_info(tasks)")
	.all()
	.map((row) => row.name);
const taskIndexes = sqlite
	.query<{ name: string }, []>(
		"SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tasks' AND sql IS NOT NULL ORDER BY name",
	)
	.all()
	.map((row) => row.name);
const brokenForeignKeys = sqlite.query("PRAGMA foreign_key_check").all();
sqlite.close();

const backups = (await readdir(root)).filter((name) =>
	name.startsWith("legado.sqlite.bak-classificacao-"),
);
const backup = backups[0] ? new Database(join(root, backups[0]), { readonly: true }) : null;
const restored = backup && {
	categories: backup.query<{ id: string }, []>("SELECT id FROM categories ORDER BY id").all(),
	tasks: backup
		.query<{ id: string; category_id: string | null; complexity: string }, []>(
			"SELECT id, category_id, complexity FROM tasks ORDER BY created_at",
		)
		.all(),
};
backup?.close();

console.log(
	JSON.stringify({
		backups,
		brokenForeignKeys,
		restored,
		run,
		session,
		tables,
		taskColumns,
		taskIndexes,
		tasks,
	}),
);
