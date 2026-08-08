import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import Database from "bun:sqlite";

const root = process.argv[2];
if (!root) {
	throw new Error("Raiz temporária não informada");
}

const databasePath = join(root, "koworker.sqlite");
const projectRoute = join(root, "project");

process.env.DATABASE_URL = databasePath;
process.env.JWT_SECRET = "task-storage-migrate-test-secret";
process.env.NODE_ENV = "development";

await mkdir(join(projectRoute, ".koworker", "adotada"), { recursive: true });
const filePath = join(projectRoute, ".koworker", "adotada", "index.md");
await Bun.write(filePath, "# Preservada\n");

const { db } = await import("./connection");
const { ensureDbSchema } = await import("./migrate");

await db
	.insertInto("users")
	.values({ id: 1, name: "Teste", password: "x", user_type: "user" })
	.execute();
await db
	.insertInto("projects")
	.values({
		id: "aaaaaaaa-0000-4000-8000-000000000001",
		name: "Projeto",
		color: "#000000",
		display_order: 0,
		main_route: projectRoute,
		hide_terminal: 0,
		task_layout_version: 1,
		created_at: 1,
	})
	.execute();
await db
	.insertInto("agent_sessions")
	.values([
		{
			id: "legacy-live",
			user_id: 1,
			project_id: "aaaaaaaa-0000-4000-8000-000000000001",
			title: "Viva",
			cli: "claude",
			cwd: projectRoute,
			permission_mode: "default",
			status: "live",
			started_at: 1,
			updated_at: 1,
		},
		{
			id: "legacy-ended",
			user_id: 1,
			project_id: "aaaaaaaa-0000-4000-8000-000000000001",
			title: "Encerrada",
			cli: "codex",
			cwd: projectRoute,
			permission_mode: "default",
			status: "ended",
			started_at: 1,
			updated_at: 2,
			ended_at: 2,
			end_reason: "Motivo original",
		},
	])
	.execute();
await db
	.insertInto("tasks")
	.values([
		{
			id: "12345678-aaaa-4000-8000-000000000001",
			project_id: "aaaaaaaa-0000-4000-8000-000000000001",
			folder_path: ".koworker/adotada",
			title: "Primeira",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 1,
		},
		{
			id: "12345678-bbbb-4000-8000-000000000002",
			project_id: "aaaaaaaa-0000-4000-8000-000000000001",
			folder_path: ".koworker/adotada",
			title: "Segunda",
			complexity: "medio",
			display_order: 1,
			done: 0,
			created_at: 2,
		},
	])
	.execute();

const before = await stat(filePath);
ensureDbSchema();
const first = await db
	.selectFrom("tasks as t")
	.select(["t.id", "t.folder_path", "t.storage_key", "t.storage_slug"])
	.orderBy("t.created_at", "asc")
	.execute();
ensureDbSchema();
const firstSessions = await db
	.selectFrom("agent_sessions")
	.select(["id", "status", "end_reason", "ended_at", "updated_at"])
	.orderBy("id")
	.execute();
const second = await db
	.selectFrom("tasks as t")
	.select(["t.id", "t.folder_path", "t.storage_key", "t.storage_slug"])
	.orderBy("t.created_at", "asc")
	.execute();
const secondSessions = await db
	.selectFrom("agent_sessions")
	.select(["id", "status", "end_reason", "ended_at", "updated_at"])
	.orderBy("id")
	.execute();
const primeAgentRoutes = await db
	.selectFrom("project_routes")
	.select(["name", "command", "icon", "route"])
	.where("project_id", "=", "aaaaaaaa-0000-4000-8000-000000000001")
	.where("command", "=", "prime-agent")
	.execute();
await db.destroy();

const sqlite = new Database(databasePath, { readonly: true });
const pathIndex = sqlite
	.query<{ name: string }, []>(
		"SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'tasks_project_folder_path_live_unique_idx'",
	)
	.get();
sqlite.close();

console.log(
	JSON.stringify({
		content: await Bun.file(filePath).text(),
		first,
		mtimePreserved: (await stat(filePath)).mtimeMs === before.mtimeMs,
		pathIndex,
		primeAgentRoutes,
		firstSessions,
		second,
		secondSessions,
	}),
);
