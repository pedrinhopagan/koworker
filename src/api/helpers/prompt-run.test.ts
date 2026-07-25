import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "bun:test";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "prompt-run-test-secret";
process.env.NODE_ENV = "development";

let parseCodexOutput: typeof import("./prompt-run").parseCodexOutput;
let startPromptRun: typeof import("./prompt-run").startPromptRun;
let reconcileStaleRuns: typeof import("./prompt-run").reconcileStaleRuns;
let dbExecutionRuns: typeof import("../db/execution-runs").dbExecutionRuns;
let trackRun: typeof import("./run-registry").trackRun;
let releaseRun: typeof import("./run-registry").releaseRun;
let FLOW_TIMEOUT_MS: number;
let projectRoute: string;

beforeAll(async () => {
	({ parseCodexOutput, reconcileStaleRuns, startPromptRun } = await import("./prompt-run"));
	({ dbExecutionRuns } = await import("../db/execution-runs"));
	({ trackRun, releaseRun } = await import("./run-registry"));
	({ FLOW_TIMEOUT_MS } = await import("./flow"));

	const { db } = await import("../db/connection");
	await db
		.insertInto("users")
		.values({ id: 3, name: "Reconciliador", password: "x", user_type: "user" })
		.execute();
	await db
		.insertInto("projects")
		.values({
			id: "project-prompt-run",
			name: "Projeto",
			color: "#000000",
			display_order: 0,
			main_route: "/tmp/project-prompt-run",
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: 1,
		})
		.execute();

	projectRoute = await mkdtemp(join(tmpdir(), "kowork-prompt-run-"));
	await db
		.insertInto("projects")
		.values({
			id: "project-execucao",
			name: "Projeto com execução",
			color: "#000000",
			display_order: 0,
			main_route: projectRoute,
			hide_terminal: 0,
			task_layout_version: 2,
			created_at: 1,
		})
		.execute();
	await db
		.insertInto("tasks")
		.values({
			id: "task-execucao",
			project_id: "project-execucao",
			folder_path: ".koworker/tasks/_sem-feature/tarefa--abcd",
			storage_key: "abcd",
			storage_slug: "tarefa",
			title: "Tarefa",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 1,
		})
		.execute();
});

describe("parseCodexOutput", () => {
	test("extrai a sessão e a mensagem final do JSONL", () => {
		const result = parseCodexOutput(
			[
				JSON.stringify({ type: "thread.started", thread_id: "thread-123" }),
				JSON.stringify({
					type: "item.completed",
					item: { type: "agent_message", text: "# Resultado\n\nTudo certo." },
				}),
			].join("\n"),
		);

		expect(result).toEqual({
			output: "# Resultado\n\nTudo certo.",
			cliSessionId: "thread-123",
		});
	});

	test("ignora eventos inválidos sem perder o resultado válido", () => {
		const result = parseCodexOutput(
			[
				"linha inválida",
				JSON.stringify({ type: "thread.started", thread_id: "thread-456" }),
				JSON.stringify({
					type: "item.completed",
					item: { type: "agent_message", text: "Resposta" },
				}),
			].join("\n"),
		);

		expect(result.output).toBe("Resposta");
		expect(result.cliSessionId).toBe("thread-456");
	});
});

describe("reconcileStaleRuns", () => {
	async function createFlowRun(input: { id: string; startedAt: number; heartbeatAt: number }) {
		await dbExecutionRuns.create({
			id: input.id,
			user_id: 3,
			project_id: "project-prompt-run",
			kind: "flow",
			title: "Fluxo",
			status: "running",
			started_at: input.startedAt,
			updated_at: input.startedAt,
			heartbeat_at: input.heartbeatAt,
		});
	}

	test("mantém o fluxo vivo além do teto de uma etapa", async () => {
		const now = Date.now();
		await createFlowRun({
			id: "flow-longo",
			startedAt: now - 60 * 60_000,
			heartbeatAt: now,
		});
		const controller = trackRun("flow-longo");

		await reconcileStaleRuns();

		expect(controller.signal.aborted).toBe(false);
		expect((await dbExecutionRuns.getByIdForUser("flow-longo", 3))?.status).toBe("running");
		releaseRun("flow-longo");
	});

	test("encerra o fluxo cujo sinal de vida parou", async () => {
		const now = Date.now();
		await createFlowRun({
			id: "flow-sem-sinal",
			startedAt: now - 10 * 60_000,
			heartbeatAt: now - 10 * 60_000,
		});

		await reconcileStaleRuns();

		const run = await dbExecutionRuns.getByIdForUser("flow-sem-sinal", 3);
		expect(run?.status).toBe("failed");
		expect(run?.error).toContain("executor caiu");
	});

	test("encerra por timeout o fluxo que passou do teto de todas as etapas", async () => {
		const now = Date.now();
		await createFlowRun({
			id: "flow-estourado",
			startedAt: now - FLOW_TIMEOUT_MS - 60_000,
			heartbeatAt: now,
		});
		const controller = trackRun("flow-estourado");

		await reconcileStaleRuns();

		expect(controller.signal.aborted).toBe(true);
		expect((await dbExecutionRuns.getByIdForUser("flow-estourado", 3))?.status).toBe("timeout");
	});
});

describe("startPromptRun", () => {
	const baseInput = {
		userId: 3,
		projectId: "project-execucao",
		title: "Tarefa",
		prompt: "faça algo",
		source: "global_bar",
		interactionMode: "unattended",
		inputKind: "text",
		cli: "claude",
	} as const;

	test("recusa uma segunda execução na mesma tarefa", async () => {
		const startedAt = Date.now();
		await dbExecutionRuns.create({
			id: "run-em-andamento",
			user_id: 3,
			project_id: "project-execucao",
			task_id: "task-execucao",
			kind: "prompt",
			title: "Tarefa",
			status: "running",
			started_at: startedAt,
			updated_at: startedAt,
			heartbeat_at: startedAt,
		});

		await expect(
			startPromptRun({
				...baseInput,
				clientRequestId: "req-duplicado",
				taskId: "task-execucao",
				cwd: projectRoute,
			}),
		).rejects.toThrow("já tem uma execução em andamento");

		const rows = await dbExecutionRuns.listForUser(3, 50);
		expect(rows.filter((row) => row.client_request_id === "req-duplicado")).toHaveLength(0);
	});

	test("devolve o mesmo run quando o clientRequestId se repete", async () => {
		const path = process.env.PATH;
		const home = process.env.HOME;
		process.env.PATH = join(projectRoute, "sem-binarios");
		process.env.HOME = join(projectRoute, "sem-home");

		try {
			const first = await startPromptRun({
				...baseInput,
				clientRequestId: "req-idempotente",
				cwd: projectRoute,
			});
			const second = await startPromptRun({
				...baseInput,
				clientRequestId: "req-idempotente",
				cwd: projectRoute,
			});

			expect(second.runId).toBe(first.runId);
		} finally {
			process.env.PATH = path;
			process.env.HOME = home;
		}

		const rows = await dbExecutionRuns.listForUser(3, 50);
		expect(rows.filter((row) => row.client_request_id === "req-idempotente")).toHaveLength(1);
	});

	test("libera a execução quando a tarefa não tem outra em andamento", async () => {
		await dbExecutionRuns.finishIfRunning("run-em-andamento", { status: "done" });
		const path = process.env.PATH;
		const home = process.env.HOME;
		process.env.PATH = join(projectRoute, "sem-binarios");
		process.env.HOME = join(projectRoute, "sem-home");

		try {
			const { runId } = await startPromptRun({
				...baseInput,
				clientRequestId: "req-liberado",
				taskId: "task-execucao",
				cwd: projectRoute,
			});

			expect(await dbExecutionRuns.getByIdForUser(runId, 3)).toBeTruthy();
		} finally {
			process.env.PATH = path;
			process.env.HOME = home;
		}
	});
});
