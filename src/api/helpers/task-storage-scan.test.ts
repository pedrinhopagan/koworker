import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "task-storage-scan-test-secret";
process.env.NODE_ENV = "development";

const root = await mkdtemp(join(tmpdir(), "koworker-task-storage-scan-"));
const outside = await mkdtemp(join(tmpdir(), "koworker-task-storage-scan-outside-"));
const projectId = "aaaaaaaa-0000-4000-8000-000000000031";
let db: typeof import("../db/connection").db;
let previewTaskStorage: typeof import("./task-storage-scan").previewTaskStorage;

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ previewTaskStorage } = await import("./task-storage-scan"));

	await mkdir(join(root, ".koworker"), { recursive: true });
	await db
		.insertInto("projects")
		.values({
			id: projectId,
			name: "Projeto scanner",
			color: "#000000",
			display_order: 0,
			main_route: root,
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: 1,
		})
		.execute();
	await db
		.insertInto("task_groups")
		.values({
			id: "bbbbbbbb-0000-4000-8000-000000000031",
			project_id: projectId,
			name: "/Tarefas",
			storage_key: "bbbbbbbb",
			storage_slug: "tarefas",
			color: "#000000",
			display_order: 0,
			created_at: 1,
		})
		.execute();

	const rows = [
		{
			id: "11111111-aaaa-4000-8000-000000000031",
			folder_path: ".koworker/flat",
			storage_key: "11111111",
			storage_slug: "flat",
		},
		{
			id: "22222222-aaaa-4000-8000-000000000031",
			folder_path: ".koworker/tasks/tarefas--bbbbbbbb/correta--22222222",
			storage_key: "22222222",
			storage_slug: "correta",
		},
		{
			id: "33333333-aaaa-4000-8000-000000000031",
			folder_path: ".koworker/divergente",
			storage_key: "33333333",
			storage_slug: "divergente",
		},
		{
			id: "44444444-aaaa-4000-8000-000000000031",
			folder_path: ".koworker/insegura",
			storage_key: "44444444",
			storage_slug: "insegura",
		},
		{
			id: "55555555-aaaa-4000-8000-000000000031",
			folder_path: ".koworker/quarentena",
			storage_key: "55555555",
			storage_slug: "quarentena",
			deleted_at: 2,
		},
		{
			id: "66666666-aaaa-4000-8000-000000000031",
			folder_path: ".koworker/reaparecida",
			storage_key: "66666666",
			storage_slug: "reaparecida",
			deleted_at: 2,
		},
	] as const;

	for (const row of rows) {
		await db
			.insertInto("tasks")
			.values({
				...row,
				project_id: projectId,
				title: row.storage_slug,
				group_id: "bbbbbbbb-0000-4000-8000-000000000031",
				complexity: "medio",
				display_order: 0,
				done: 0,
				created_at: 1,
			})
			.execute();
	}

	await mkdir(join(root, ".koworker", "flat"));
	await Bun.write(join(root, ".koworker", "flat", "index.md"), "flat");
	await mkdir(join(root, ".koworker", "tasks", "tarefas--bbbbbbbb", "correta--22222222"), {
		recursive: true,
	});
	await Bun.write(
		join(root, ".koworker", "tasks", "tarefas--bbbbbbbb", "correta--22222222", "index.md"),
		"correta",
	);
	await mkdir(join(root, ".koworker", "divergente"));
	await Bun.write(join(root, ".koworker", "divergente", "index.md"), "origem");
	await mkdir(join(root, ".koworker", "tasks", "tarefas--bbbbbbbb", "divergente--33333333"), {
		recursive: true,
	});
	await Bun.write(
		join(root, ".koworker", "tasks", "tarefas--bbbbbbbb", "divergente--33333333", "index.md"),
		"destino",
	);
	await symlink(outside, join(root, ".koworker", "insegura"));
	await mkdir(join(root, ".koworker", "reaparecida"));
	await Bun.write(join(root, ".koworker", "reaparecida", "index.md"), "reaparecida");
	await mkdir(join(root, ".koworker", "orfao"));
	await Bun.write(join(root, ".koworker", "orfao", "index.md"), "órfão");
});

afterAll(async () => {
	await db.deleteFrom("tasks").where("project_id", "=", projectId).execute();
	await db.deleteFrom("task_groups").where("project_id", "=", projectId).execute();
	await db.deleteFrom("projects").where("id", "=", projectId).execute();
	await Promise.all([
		rm(root, { recursive: true, force: true }),
		rm(outside, { recursive: true, force: true }),
	]);
});

describe("previewTaskStorage", () => {
	test("classifica sem alterar DB, conteúdo ou mtime e mantém planHash estável", async () => {
		const file = join(root, ".koworker", "flat", "index.md");
		const before = await stat(file);
		const first = await previewTaskStorage(projectId);
		const second = await previewTaskStorage(projectId);
		const kindByTask = new Map(first.items.map((item) => [item.taskId.slice(0, 8), item.kind]));

		expect(kindByTask).toEqual(
			new Map([
				["11111111", "flat_migratable"],
				["22222222", "correct"],
				["33333333", "source_destination_divergent"],
				["44444444", "unsafe_path"],
				["55555555", "correct"],
				["66666666", "soft_deleted_reappeared"],
			]),
		);
		expect(first.orphans.map((orphan) => orphan.folderPath)).toEqual([".koworker/orfao"]);
		expect(first.planHash).toBe(second.planHash);
		expect(await Bun.file(file).text()).toBe("flat");
		expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
		expect((await dbProjectsLayout()).task_layout_version).toBe(1);
	});
});

async function dbProjectsLayout() {
	return await db
		.selectFrom("projects as p")
		.select("p.task_layout_version")
		.where("p.id", "=", projectId)
		.executeTakeFirstOrThrow();
}
