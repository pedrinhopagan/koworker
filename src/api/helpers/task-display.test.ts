import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { HOME_RECENT_TASK_LIMIT } from "@/constants/tasks";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "recent-tasks-test-secret";
process.env.NODE_ENV = "development";

const projectId = "recent-tasks-project";
const otherProjectId = "recent-tasks-other-project";
const baseTime = 1_800_000_000_000;
const root = await mkdtemp(join(tmpdir(), "kowork-recent-tasks-"));
let db: typeof import("@/api/db/connection").db;
let getRecentTasks: typeof import("./task-display").getRecentTasks;

beforeAll(async () => {
	({ db } = await import("@/api/db/connection"));
	({ getRecentTasks } = await import("./task-display"));

	await db
		.insertInto("projects")
		.values(
			[projectId, otherProjectId].map((id) => ({
				id,
				name: id,
				main_route: root,
				color: "#123456",
				display_order: 0,
				hide_terminal: 0,
				task_layout_version: 1,
				created_at: baseTime,
			})),
		)
		.execute();

	await db
		.insertInto("tasks")
		.values(
			Array.from({ length: 55 }, (_, index) => ({
				id: `recent-task-${index}`,
				project_id: projectId,
				folder_path: `.koworker/recent-task-${index}`,
				title: `Tarefa ${index}`,
				display_order: index,
				done: 0,
				created_at: baseTime - index * 1000,
			})),
		)
		.execute();

	await db
		.updateTable("tasks")
		.set({ done: 1, completed_at: baseTime + 4000 })
		.where("id", "=", "recent-task-51")
		.execute();
	await db
		.updateTable("tasks")
		.set({ updated_at: baseTime + 3000 })
		.where("id", "=", "recent-task-52")
		.execute();
	await db
		.updateTable("tasks")
		.set({ created_at: baseTime + 2000 })
		.where("id", "=", "recent-task-54")
		.execute();
	await db
		.updateTable("tasks")
		.set({ updated_at: baseTime + 9000, deleted_at: baseTime + 9000 })
		.where("id", "=", "recent-task-53")
		.execute();
	await db
		.insertInto("tasks")
		.values({
			id: "recent-other-project-task",
			project_id: otherProjectId,
			folder_path: ".koworker/other",
			title: "Outro projeto",
			display_order: 0,
			done: 0,
			created_at: baseTime + 10000,
		})
		.execute();

	for (const [index, offset] of [
		[3, 5000],
		[1, 1000],
	]) {
		const folder = join(root, ".koworker", `recent-task-${index}`);
		await mkdir(folder, { recursive: true });
		const file = join(folder, "index.md");
		await Bun.write(file, "# Tarefa editada no disco");
		const editedAt = new Date(baseTime + offset);
		await utimes(file, editedAt, editedAt);
	}
});

afterAll(async () => {
	await db.deleteFrom("tasks").where("project_id", "in", [projectId, otherProjectId]).execute();
	await db.deleteFrom("projects").where("id", "in", [projectId, otherProjectId]).execute();
	await rm(root, { recursive: true });
});

describe("getRecentTasks", () => {
	test("combina edições no disco e atualizações, incluindo concluídas além da primeira página", async () => {
		const tasks = await getRecentTasks({ projectId });

		expect(tasks).toHaveLength(HOME_RECENT_TASK_LIMIT);
		expect(tasks.map((task) => task.id)).toEqual([
			"recent-task-3",
			"recent-task-51",
			"recent-task-52",
			"recent-task-54",
			"recent-task-1",
		]);
		expect(tasks.map((task) => task.lastTouchedAt)).toEqual(
			[5000, 4000, 3000, 2000, 1000].map((offset) => baseTime + offset),
		);
		expect(tasks[1]?.done).toBe(true);
		expect(tasks.every((task) => task.projectId === projectId)).toBe(true);
	});

	test("projeto vazio devolve lista vazia", async () => {
		expect(await getRecentTasks({ projectId: "recent-empty-project" })).toEqual([]);
	});
});
