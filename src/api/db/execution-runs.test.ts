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
			task_layout_version: 1,
			created_at: 1,
		})
		.execute();
	await sql`CREATE UNIQUE INDEX execution_runs_user_request_test_idx ON execution_runs (user_id, client_request_id) WHERE client_request_id IS NOT NULL`.execute(
		db,
	);
	await sql`CREATE UNIQUE INDEX execution_runs_running_session_test_idx ON execution_runs (cli_session_id) WHERE cli_session_id IS NOT NULL AND status = 'running' AND deleted_at IS NULL`.execute(
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

	test("limpa apenas execuções finalizadas do próprio usuário", async () => {
		await dbExecutionRuns.update("run-1", { status: "done", finished_at: Date.now() });
		await dbExecutionRuns.create({
			id: "run-running",
			user_id: 1,
			project_id: "project-execution-runs",
			kind: "prompt",
			title: "Em andamento",
			status: "running",
			started_at: 4,
			updated_at: 4,
		});

		const cleared = await dbExecutionRuns.softDeleteFinishedForUser(
			["run-1", "run-running", "run-2"],
			1,
		);

		expect(cleared).toBe(1);
		expect((await dbExecutionRuns.listForUser(1, 20)).map((run) => run.id)).toEqual([
			"run-running",
		]);
		expect(await dbExecutionRuns.getByIdForUser("run-1", 1)).toBeUndefined();
		expect(await dbExecutionRuns.getByRequestIdForUser("request-1", 1)).toBeDefined();
		expect(await dbExecutionRuns.getByIdForUser("run-2", 2)).toBeDefined();
	});

	test("impede duas continuações simultâneas da mesma sessão", async () => {
		await dbExecutionRuns.create({
			id: "run-continuation-1",
			user_id: 1,
			project_id: "project-execution-runs",
			kind: "prompt",
			title: "Continuação 1",
			status: "running",
			cli_session_id: "session-1",
			started_at: 5,
			updated_at: 5,
		});

		let error: unknown;
		try {
			await dbExecutionRuns.create({
				id: "run-continuation-2",
				user_id: 1,
				project_id: "project-execution-runs",
				kind: "prompt",
				title: "Continuação 2",
				status: "running",
				cli_session_id: "session-1",
				started_at: 6,
				updated_at: 6,
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
	});

	test("lista como parada a execução sem sinal de vida e a que estourou o teto", async () => {
		const now = Date.now();
		await dbExecutionRuns.create({
			id: "run-heartbeat-vivo",
			user_id: 1,
			project_id: "project-execution-runs",
			kind: "prompt",
			title: "Viva",
			status: "running",
			started_at: now,
			updated_at: now,
			heartbeat_at: now,
		});
		await dbExecutionRuns.create({
			id: "run-heartbeat-morto",
			user_id: 1,
			project_id: "project-execution-runs",
			kind: "prompt",
			title: "Sem sinal",
			status: "running",
			started_at: now,
			updated_at: now,
			heartbeat_at: now - 120_000,
		});
		await dbExecutionRuns.create({
			id: "run-estourado",
			user_id: 1,
			project_id: "project-execution-runs",
			kind: "prompt",
			title: "Estourada",
			status: "running",
			started_at: now - 60 * 60_000,
			updated_at: now,
			heartbeat_at: now,
		});

		const stale = (
			await dbExecutionRuns.listStale({
				heartbeatBefore: now - 90_000,
				promptStartedBefore: now - 45 * 60_000,
				flowStartedBefore: now - 225 * 60_000,
			})
		).map((run) => run.id);

		expect(stale).toContain("run-heartbeat-morto");
		expect(stale).toContain("run-estourado");
		expect(stale).not.toContain("run-heartbeat-vivo");
	});

	test("reconcilia fluxo pelo mesmo critério de sinal de vida", async () => {
		const now = Date.now();
		await dbExecutionRuns.create({
			id: "flow-heartbeat-vivo",
			user_id: 1,
			project_id: "project-execution-runs",
			kind: "flow",
			title: "Fluxo vivo",
			status: "running",
			started_at: now,
			updated_at: now,
			heartbeat_at: now,
		});
		await dbExecutionRuns.create({
			id: "flow-heartbeat-morto",
			user_id: 1,
			project_id: "project-execution-runs",
			kind: "flow",
			title: "Fluxo sem sinal",
			status: "running",
			started_at: now,
			updated_at: now,
			heartbeat_at: now - 120_000,
		});
		await dbExecutionRuns.create({
			id: "flow-longo-vivo",
			user_id: 1,
			project_id: "project-execution-runs",
			kind: "flow",
			title: "Fluxo de várias etapas",
			status: "running",
			started_at: now - 60 * 60_000,
			updated_at: now,
			heartbeat_at: now,
		});

		const stale = (
			await dbExecutionRuns.listStale({
				heartbeatBefore: now - 90_000,
				promptStartedBefore: now - 45 * 60_000,
				flowStartedBefore: now - 225 * 60_000,
			})
		).map((run) => run.id);

		expect(stale).toContain("flow-heartbeat-morto");
		expect(stale).not.toContain("flow-heartbeat-vivo");
		expect(stale).not.toContain("flow-longo-vivo");
	});

	test("não ressuscita para em andamento um run já encerrado", async () => {
		await dbExecutionRuns.finishIfRunning("flow-heartbeat-vivo", {
			status: "cancelled",
			error: "Cancelado",
		});

		expect(
			await dbExecutionRuns.updateIfRunning("flow-heartbeat-vivo", {
				status: "running",
				stage: "grill",
			}),
		).toBe(false);
		expect((await dbExecutionRuns.getByIdForUser("flow-heartbeat-vivo", 1))?.status).toBe(
			"cancelled",
		);
	});

	test("renova o sinal de vida apenas das execuções em andamento", async () => {
		await dbExecutionRuns.update("run-heartbeat-morto", { status: "failed" });
		await dbExecutionRuns.touchHeartbeat(["run-heartbeat-vivo", "run-heartbeat-morto"]);

		const [alive, finished] = await Promise.all([
			dbExecutionRuns.getByIdForUser("run-heartbeat-vivo", 1),
			dbExecutionRuns.getByIdForUser("run-heartbeat-morto", 1),
		]);

		expect(alive?.heartbeat_at).toBeGreaterThan(finished?.heartbeat_at ?? 0);
	});
});
