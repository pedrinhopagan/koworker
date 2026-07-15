import { beforeAll, describe, expect, test } from "bun:test";
import { sql } from "kysely";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "execution-runs-test-secret";
process.env.NODE_ENV = "development";

let db: typeof import("./connection").db;
let dbExecutionRuns: typeof import("./execution-runs").dbExecutionRuns;

beforeAll(async () => {
	({ db } = await import("./connection"));
	({ dbExecutionRuns } = await import("./execution-runs"));

	await db
		.insertInto("users")
		.values([
			{ id: 1, name: "Um", password: "x", user_type: "user" },
			{ id: 2, name: "Dois", password: "x", user_type: "user" },
		])
		.execute();
	await db
		.insertInto("projects")
		.values({
			id: "project-execution-runs",
			name: "Projeto",
			color: "#000000",
			display_order: 0,
			main_route: "/tmp/project-execution-runs",
			hide_terminal: 0,
			created_at: 1,
		})
		.execute();
	await sql`CREATE UNIQUE INDEX execution_runs_user_request_test_idx ON execution_runs (user_id, client_request_id) WHERE client_request_id IS NOT NULL`.execute(
		db,
	);
});

describe("dbExecutionRuns", () => {
	test("isola a chave idempotente por usuário", async () => {
		for (const userId of [1, 2]) {
			await dbExecutionRuns.create({
				id: `run-${userId}`,
				user_id: userId,
				project_id: "project-execution-runs",
				client_request_id: "request-1",
				kind: "prompt",
				title: "Execução",
				status: "running",
				started_at: userId,
				updated_at: userId,
			});
		}

		expect((await dbExecutionRuns.getByRequestIdForUser("request-1", 1))?.id).toBe("run-1");
		expect((await dbExecutionRuns.getByRequestIdForUser("request-1", 2))?.id).toBe("run-2");
	});

	test("impede dois runs da mesma requisição", async () => {
		let error: unknown;
		try {
			await dbExecutionRuns.create({
				id: "run-duplicate",
				user_id: 1,
				project_id: "project-execution-runs",
				client_request_id: "request-1",
				kind: "prompt",
				title: "Duplicada",
				status: "running",
				started_at: 3,
				updated_at: 3,
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
	});

	test("lista apenas o histórico do usuário mais recente primeiro", async () => {
		const runs = await dbExecutionRuns.listForUser(1, 20);

		expect(runs.map((run) => run.id)).toEqual(["run-1"]);
	});
});
