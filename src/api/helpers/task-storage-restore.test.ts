import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "task-storage-restore-test-secret";
process.env.NODE_ENV = "development";

const root = await mkdtemp(join(tmpdir(), "koworker-task-storage-restore-"));
const projectId = "aaaaaaaa-0000-4000-8000-000000000061";
const groupId = "bbbbbbbb-0000-4000-8000-000000000061";
const restorableId = "11111111-aaaa-4000-8000-000000000061";
const occupiedId = "22222222-aaaa-4000-8000-000000000061";
const liveId = "33333333-aaaa-4000-8000-000000000061";
let db: typeof import("../db/connection").db;
let quarantineTaskStorage: typeof import("./task-storage-coordinator").quarantineTaskStorage;
let restoreTaskStorage: typeof import("./task-storage-coordinator").restoreTaskStorage;

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ quarantineTaskStorage, restoreTaskStorage } = await import("./task-storage-coordinator"));

	await db
		.insertInto("projects")
		.values({
			id: projectId,
			name: "Projeto restore",
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
		.values({
			id: groupId,
			project_id: projectId,
			name: "A",
			storage_key: "bbbbbbbb",
			storage_slug: "a",
			color: "#000000",
			display_order: 0,
			created_at: 1,
		})
		.execute();

	for (const task of [
		{ id: restorableId, key: "11111111", slug: "restaurar" },
		{ id: occupiedId, key: "22222222", slug: "ocupada" },
		{ id: liveId, key: "33333333", slug: "viva" },
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
				group_id: groupId,
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

describe("restoreTaskStorage", () => {
	test("devolve conteúdo e vínculo depois da quarentena", async () => {
		const quarantined = await quarantineTaskStorage(restorableId);
		expect(await Bun.file(join(root, quarantined.task.folder_path, "index.md")).exists()).toBe(
			false,
		);

		const restored = await restoreTaskStorage(restorableId);
		const task = await db
			.selectFrom("tasks")
			.selectAll()
			.where("id", "=", restorableId)
			.executeTakeFirstOrThrow();

		expect(task.deleted_at).toBeNull();
		expect(restored.restoredPath).toBe(join(root, task.folder_path));
		expect(await Bun.file(join(root, task.folder_path, "index.md")).text()).toBe("restaurar");
		expect(await Bun.file(join(quarantined.backup, "index.md")).exists()).toBe(false);
	});

	test("recusa restaurar tarefa que não está removida", async () => {
		let error: unknown;
		try {
			await restoreTaskStorage(liveId);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe("A tarefa não está removida");
	});

	test("bloqueia quando o destino voltou a ser ocupado", async () => {
		const quarantined = await quarantineTaskStorage(occupiedId);
		await mkdir(join(root, quarantined.task.folder_path), { recursive: true });
		await Bun.write(join(root, quarantined.task.folder_path, "index.md"), "intruso");

		let error: unknown;
		try {
			await restoreTaskStorage(occupiedId);
		} catch (caught) {
			error = caught;
		}
		const task = await db
			.selectFrom("tasks")
			.selectAll()
			.where("id", "=", occupiedId)
			.executeTakeFirstOrThrow();

		expect(error).toBeInstanceOf(Error);
		expect(task.deleted_at).toBeNumber();
		expect(await Bun.file(join(quarantined.backup, "index.md")).text()).toBe("ocupada");
		expect(await Bun.file(join(root, quarantined.task.folder_path, "index.md")).text()).toBe(
			"intruso",
		);
	});
});
