import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
	throw new Error("Raiz temporária não informada");
}

const databasePath = join(root, "koworker.sqlite");
const projectRoute = join(root, "project");
await mkdir(join(projectRoute, ".koworker"), { recursive: true });

process.env.DATABASE_URL = databasePath;
process.env.JWT_SECRET = "cli-feature-test-secret";
process.env.NODE_ENV = "development";

const { db } = await import("@/api/db/connection");
const { dbTaskGroups } = await import("@/api/db/task-groups");

const projectId = "aaaaaaaa-0000-4000-8000-000000000031";
await db
	.insertInto("projects")
	.values({
		id: projectId,
		name: "Projeto",
		color: "#000000",
		display_order: 0,
		main_route: projectRoute,
		hide_terminal: 0,
		task_layout_version: 2,
		created_at: 1,
	})
	.execute();
await dbTaskGroups.create({
	id: "bbbbbbbb-0000-4000-8000-000000000031",
	project_id: projectId,
	name: "Planejamento",
	storage_key: "bbbbbbbb",
	storage_slug: "planejamento",
});

async function runCli(args: string[], cwd = projectRoute) {
	const child = Bun.spawn(
		[process.execPath, "run", join(process.cwd(), "src/cli/index.ts"), ...args],
		{
			cwd,
			env: {
				...process.env,
				KOWORK_DATABASE_URL: databasePath,
			},
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);

	return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}

const featureCreate = await runCli(["feature", "create", "Nova", "Área"]);
const duplicateFeatureCreate = await runCli(["feature", "create", "nova", "área"]);
const createdFeature = await db
	.selectFrom("task_groups")
	.selectAll()
	.where("project_id", "=", projectId)
	.where("name", "=", "Nova Área")
	.executeTakeFirst();
const featureSearch = await runCli(["feature", "list", "nova"]);
const featureByProject = await runCli(["feature", "list", "planeja", "--project", projectId], root);
const taskCreate = await runCli(["task", "create", "Minha tarefa", "--feature", "Nova Área"]);
const taskWithoutFeature = await runCli(["task", "create", "Sem feature"]);
const createdTask = await db
	.selectFrom("tasks")
	.selectAll()
	.where("project_id", "=", projectId)
	.where("title", "=", "Minha tarefa")
	.executeTakeFirst();

await dbTaskGroups.create({
	id: "cccccccc-0000-4000-8000-000000000031",
	project_id: projectId,
	name: "Duplicada",
	storage_key: "cccccccc",
	storage_slug: "duplicada",
});
await dbTaskGroups.create({
	id: "dddddddd-0000-4000-8000-000000000031",
	project_id: projectId,
	name: "Dúplicada",
	storage_key: "dddddddd",
	storage_slug: "duplicada",
});
const ambiguousTaskCreate = await runCli(["task", "create", "Não criar", "--feature", "duplicada"]);

await db.destroy();

console.log(
	JSON.stringify({
		featureCreate,
		duplicateFeatureCreate,
		featureSearch,
		featureByProject,
		taskCreate,
		taskWithoutFeature,
		ambiguousTaskCreate,
		createdFeature: createdFeature && {
			id: createdFeature.id,
			storageKeyLength: createdFeature.storage_key?.length,
			storageSlug: createdFeature.storage_slug,
			displayOrder: createdFeature.display_order,
		},
		createdTask: createdTask && {
			groupId: createdTask.group_id,
			folderPath: createdTask.folder_path,
			indexExists: existsSync(join(projectRoute, createdTask.folder_path, "index.md")),
		},
	}),
);
