import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "task-storage-relink-test-secret";
process.env.NODE_ENV = "development";

const root = await mkdtemp(join(tmpdir(), "koworker-task-storage-relink-"));
const projectId = "aaaaaaaa-0000-4000-8000-000000000051";
const groupA = "bbbbbbbb-0000-4000-8000-000000000051";
const groupB = "cccccccc-0000-4000-8000-000000000051";
let db: typeof import("../db/connection").db;
let relinkTasks: typeof import("./task-storage-coordinator").relinkTasks;
let quarantineTaskStorage: typeof import("./task-storage-coordinator").quarantineTaskStorage;

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ quarantineTaskStorage, relinkTasks } = await import("./task-storage-coordinator"));

	await db
		.insertInto("projects")
		.values({
			id: projectId,
			name: "Projeto relink",
			color: "#000000",
			display_order: 0,
			main_route: root,
			hide_terminal: 0,
			task_layout_version: 2,
			created_at: 1,
		})
		.execute();
	await db
		.insertInto("task_groups")
		.values([
			{
				id: groupA,
				project_id: projectId,
				name: "A",
				storage_key: "bbbbbbbb",
				storage_slug: "a",
				color: "#000000",
				display_order: 0,
				created_at: 1,
			},
			{
				id: groupB,
				project_id: projectId,
				name: "B",
				storage_key: "cccccccc",
				storage_slug: "b",
				color: "#000000",
				display_order: 1,
				created_at: 2,
			},
		])
		.execute();

	for (const task of [
		{ id: "11111111-aaaa-4000-8000-000000000051", key: "11111111", slug: "movel" },
		{ id: "22222222-aaaa-4000-8000-000000000051", key: "22222222", slug: "conflito" },
		{ id: "33333333-aaaa-4000-8000-000000000051", key: "33333333", slug: "quarentena" },
	]) {
		const folderPath = `.koworker/tasks/a--bbbbbbbb/${task.slug}--${task.key}`;
		await mkdir(join(root, folderPath), { recursive: true });
		await Bun.write(join(root, folderPath, "index.md"), task.slug);
		await db
			.insertInto("tasks")
			.values({
				id: task.id,
				project_id: projectId,
				folder_path: folderPath,
				storage_key: task.key,
				storage_slug: task.slug,
				title: task.slug,
				group_id: groupA,
				complexity: "medio",
				display_order: 0,
				done: 0,
				created_at: 1,
			})
			.execute();
	}
});

afterAll(async () => {
	await db.deleteFrom("tasks").where("project_id", "=", projectId).execute();
	await db.deleteFrom("task_groups").where("project_id", "=", projectId).execute();
	await db.deleteFrom("projects").where("id", "=", projectId).execute();
	await rm(root, { recursive: true, force: true });
});

describe("relinkTasks", () => {
	test("move conteúdo e vínculo juntos preservando backup", async () => {
		const [task] = await relinkTasks({
			intents: [
				{
					taskId: "11111111-aaaa-4000-8000-000000000051",
					targetProjectId: projectId,
					targetGroupId: groupB,
				},
			],
		});
		if (!task) {
			throw new Error("Tarefa não retornada pelo relink");
		}

		expect(task.group_id).toBe(groupB);
		expect(task.folder_path).toBe(".koworker/tasks/b--cccccccc/movel--11111111");
		expect(await Bun.file(join(root, task.folder_path, "index.md")).text()).toBe("movel");
		const [runId] = await readdir(join(root, ".koworker", ".backups", "relinks"));
		expect(runId).toBeTruthy();
		const backup = join(
			root,
			".koworker",
			".backups",
			"relinks",
			runId,
			"11111111-aaaa-4000-8000-000000000051",
			"index.md",
		);
		expect(await Bun.file(backup).text()).toBe("movel");
	});

	test("bloqueia destino divergente sem alterar origem ou DB", async () => {
		const destination = ".koworker/tasks/b--cccccccc/conflito--22222222";
		await mkdir(join(root, destination), { recursive: true });
		await Bun.write(join(root, destination, "index.md"), "outro");

		let error: unknown;
		try {
			await relinkTasks({
				intents: [
					{
						taskId: "22222222-aaaa-4000-8000-000000000051",
						targetProjectId: projectId,
						targetGroupId: groupB,
					},
				],
			});
		} catch (caught) {
			error = caught;
		}
		const task = await db
			.selectFrom("tasks as t")
			.selectAll("t")
			.where("t.id", "=", "22222222-aaaa-4000-8000-000000000051")
			.executeTakeFirstOrThrow();

		expect(error).toBeInstanceOf(Error);
		expect(task.group_id).toBe(groupA);
		expect(task.folder_path).toBe(".koworker/tasks/a--bbbbbbbb/conflito--22222222");
		expect(await Bun.file(join(root, task.folder_path, "index.md")).text()).toBe("conflito");
		expect(await Bun.file(join(root, destination, "index.md")).text()).toBe("outro");
	});

	test("remove por quarentena verificada sem apagar conteúdo", async () => {
		const result = await quarantineTaskStorage("33333333-aaaa-4000-8000-000000000051");
		const task = await db
			.selectFrom("tasks")
			.selectAll()
			.where("id", "=", result.task.id)
			.executeTakeFirstOrThrow();

		expect(task.deleted_at).toBeNumber();
		expect(await Bun.file(join(result.backup, "index.md")).text()).toBe("quarentena");
		expect(await Bun.file(join(root, result.task.folder_path, "index.md")).exists()).toBe(false);
	});
});
