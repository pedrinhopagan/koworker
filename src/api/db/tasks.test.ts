import { beforeAll, describe, expect, test } from "bun:test";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "tasks-pagination-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("./connection").db;
let dbTasks: typeof import("./tasks").dbTasks;

beforeAll(async () => {
	({ db } = await import("./connection"));
	({ dbTasks } = await import("./tasks"));

	await db
		.insertInto("projects")
		.values({
			id: "project-1",
			name: "Projeto",
			color: "#000000",
			display_order: 0,
			main_route: "/tmp/project-1",
			hide_terminal: 0,
			created_at: 1,
		})
		.execute();

	await db
		.insertInto("tasks")
		.values(
			Array.from({ length: 75 }, (_, index) => ({
				id: `task-${index}`,
				project_id: "project-1",
				folder_path: `.koworker/task-${index}`,
				title: `Tarefa ${index}`,
				complexity: "medio",
				display_order: index,
				done: 0,
				created_at: index + 1,
			})),
		)
		.execute();
});

describe("dbTasks.getAll", () => {
	test("usa uma página segura quando o limite não é informado", async () => {
		const tasks = await dbTasks.getAll({
			projectId: "project-1",
			includeCompleted: false,
		});

		expect(tasks).toHaveLength(50);
	});

	test("limita a quantidade de tarefas carregadas por página", async () => {
		const tasks = await dbTasks.getAll({
			projectId: "project-1",
			includeCompleted: false,
			limit: 50,
		});

		expect(tasks).toHaveLength(50);
	});

	test("carrega a página seguinte a partir do offset", async () => {
		const tasks = await dbTasks.getAll({
			projectId: "project-1",
			includeCompleted: false,
			limit: 50,
			offset: 50,
		});

		expect(tasks).toHaveLength(25);
		expect(tasks[0]?.id).toBe("task-50");
	});
});
