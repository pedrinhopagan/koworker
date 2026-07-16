import { beforeAll, describe, expect, test } from "bun:test";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "task-worktree-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("./connection").db;
let dbTasks: typeof import("./tasks").dbTasks;

beforeAll(async () => {
	({ db } = await import("./connection"));
	({ dbTasks } = await import("./tasks"));

	await db
		.insertInto("projects")
		.values({
			id: "project-worktree",
			name: "Projeto",
			color: "#000000",
			display_order: 0,
			main_route: "/tmp/project-worktree",
			hide_terminal: 0,
			created_at: 1,
		})
		.execute();
	await dbTasks.create({
		id: "task-worktree",
		project_id: "project-worktree",
		folder_path: ".koworker/task-worktree",
		title: "Entrega paralela",
	});
});

describe("metadados de worktree da tarefa", () => {
	test("grava a entrega pronta sem concluir a tarefa", async () => {
		await dbTasks.update({
			id: "task-worktree",
			merge_ready_at: 100,
			worktree_branch: "worktree/task-worktree-entrega",
			merge_target_branch: "dev",
			worktree_path: "/tmp/project-worktree-02",
			worktree_pr_url: "https://github.com/acme/repo/pull/1",
		});

		const task = await dbTasks.getById("task-worktree");

		expect(task?.done).toBe(0);
		expect(task?.merge_ready_at).toBe(100);
		expect(task?.worktree_branch).toBe("worktree/task-worktree-entrega");
		expect(task?.merge_target_branch).toBe("dev");
		expect(task?.worktree_path).toBe("/tmp/project-worktree-02");
		expect(task?.worktree_pr_url).toBe("https://github.com/acme/repo/pull/1");
	});

	test("limpa a entrega ao concluir o merge", async () => {
		await dbTasks.update({
			id: "task-worktree",
			done: 1,
			completed_at: 200,
			merge_ready_at: null,
			worktree_branch: null,
			merge_target_branch: null,
			worktree_path: null,
			worktree_pr_url: null,
		});

		const task = await dbTasks.getById("task-worktree");

		expect(task?.done).toBe(1);
		expect(task?.completed_at).toBe(200);
		expect(task?.merge_ready_at).toBeNull();
		expect(task?.worktree_branch).toBeNull();
		expect(task?.merge_target_branch).toBeNull();
		expect(task?.worktree_path).toBeNull();
		expect(task?.worktree_pr_url).toBeNull();
	});
});
