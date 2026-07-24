import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
	throw new Error("Raiz temporária não informada");
}

process.env.DATABASE_URL = join(root, "koworker.sqlite");
process.env.JWT_SECRET = "cli-resolve-test-secret";
process.env.NODE_ENV = "development";

const projectRoute = join(root, "project");
const otherRoute = join(root, "other");
await mkdir(join(projectRoute, ".koworker", "tasks", "tarefas--aaaaaaaa", "storage--11111111"), {
	recursive: true,
});
await mkdir(otherRoute, { recursive: true });

const { db } = await import("@/api/db/connection");
const { resolveTask } = await import("./resolve");

await db
	.insertInto("projects")
	.values([
		{
			id: "aaaaaaaa-0000-4000-8000-000000000021",
			name: "Projeto",
			color: "#000000",
			display_order: 0,
			main_route: projectRoute,
			hide_terminal: 0,
			task_layout_version: 2,
			created_at: 1,
		},
		{
			id: "aaaaaaaa-0000-4000-8000-000000000022",
			name: "Outro",
			color: "#000000",
			display_order: 1,
			main_route: otherRoute,
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: 2,
		},
	])
	.execute();
await db
	.insertInto("tasks")
	.values([
		{
			id: "11111111-aaaa-4000-8000-000000000021",
			project_id: "aaaaaaaa-0000-4000-8000-000000000021",
			folder_path: ".koworker/tasks/tarefas--aaaaaaaa/storage--11111111",
			storage_key: "11111111",
			storage_slug: "storage",
			title: "Storage",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 1,
		},
		{
			id: "22222222-bbbb-4000-8000-000000000022",
			project_id: "aaaaaaaa-0000-4000-8000-000000000022",
			folder_path: ".koworker/22222222",
			storage_key: "22222222",
			storage_slug: "outra",
			title: "Outra",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 2,
		},
	])
	.execute();

process.chdir(projectRoute);
const byId = await resolveTask("11111111-aaaa-4000-8000-000000000021");
const byKey = await resolveTask("11111111");
const byPath = await resolveTask(
	join(projectRoute, ".koworker", "tasks", "tarefas--aaaaaaaa", "storage--11111111", "index.md"),
);
const crossProject = await resolveTask("22222222-bbbb-4000-8000-000000000022");

await db.destroy();

console.log(
	JSON.stringify({
		byId: byId?.id,
		byKey: byKey?.id,
		byPath: byPath?.id,
		crossProject: crossProject?.id,
	}),
);
