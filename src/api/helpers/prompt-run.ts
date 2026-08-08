import { type InvokeCli } from "@/constants/invoke";
import { type AgentStep, createAgentStreamParser, mergeAgentSteps } from "@/lib/agent-stream";
import { buildClaudeArgv } from "@/lib/claude-command";
import { buildCodexExecArgs } from "@/lib/codex-command";
import { ORPCError } from "@orpc/server";
import type { execution_runs } from "../db/connection";
import { dbExecutionRuns } from "../db/execution-runs";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { PubSub, type PromptRunEvent } from "../pubsub";
import {
	type ExecutionTerminalHandle,
	openExecutionTerminal,
	readNewLogBytes,
} from "./execution-terminal";
import { finishFlowRunExternally, FLOW_TIMEOUT_MS } from "./flow";
import { getSystemSettings } from "./system-settings";
import { PushNotifications } from "./push-notifications";
import { getActiveRun, HEARTBEAT_STALE_MS, releaseRun, trackRun } from "./run-registry";
import { applyRunStepPatches, getRunSteps } from "./run-steps";
import { spawnCapture } from "./spawn";
import { createTask, rollbackCreatedTask, taskAutoTitleInstruction } from "./task-creation";
import { withProjectStorageLock } from "./task-storage-coordinator";

const RUN_TIMEOUT_MS = 45 * 60_000;
const MAX_OUTPUT_CHARS = 20_000;
const MAX_ERROR_DETAIL_CHARS = 1_200;
const RECONCILE_INTERVAL_MS = 60_000;
const LIVE_OUTPUT_INTERVAL_MS = 500;
const LIVE_OUTPUT_MAX_CHARS = 4_000;

// A execução roda sem TTY e sem ninguém pra responder um prompt: qualquer subprocesso que o agente
// dispare (git, editor, pager) precisa falhar rápido em vez de bloquear esperando entrada que nunca
// vem. Sem estes guards, um `git commit` sem `-m` abre editor, um `git push` sem credencial pede
// senha e um comando com pager trava — a sessão fica presa até o teto de 45 min.
const HEADLESS_ENV: Record<string, string> = {
	GIT_TERMINAL_PROMPT: "0",
	GIT_EDITOR: "true",
	GIT_PAGER: "cat",
	EDITOR: "true",
	VISUAL: "true",
	PAGER: "cat",
	CI: "true",
	DEBIAN_FRONTEND: "noninteractive",
};

export type PromptRunStatus = "running" | "done" | "failed" | "timeout" | "cancelled";

export type PromptRunRecord = {
	runId: string;
	userId: number;
	status: PromptRunStatus;
	startedAt: number;
	finishedAt?: number;
	output?: string;
	error?: string;
	projectId: string;
	taskId?: string;
	title: string;
	prompt: string;
	originalPrompt?: string;
	source?: string;
	inputKind?: string;
	cli?: string;
	model?: string;
	effort?: string;
	parentRunId?: string;
	cliSessionId?: string;
};

function truncateOutput(value: string): string {
	if (value.length <= MAX_OUTPUT_CHARS) {
		return value;
	}
	return `${value.slice(0, MAX_OUTPUT_CHARS)}\n… (truncado)`;
}

// O que o agente escreveu em stderr é a única pista do motivo de uma saída != 0. Sem isso a UI
// mostrava só "A execução falhou (código 1)" e não havia como saber o que aconteceu.
function failureMessage(exitCode: number, stderr: string): string {
	const detail = stderr.trim();
	if (!detail) {
		return `A execução falhou (código ${exitCode}).`;
	}

	const tail =
		detail.length > MAX_ERROR_DETAIL_CHARS ? detail.slice(-MAX_ERROR_DETAIL_CHARS) : detail;

	return `A execução falhou (código ${exitCode}): ${tail}`;
}

async function emit(event: PromptRunEvent): Promise<void> {
	await PubSub.publish("promptRun", event.runId, event);
}

function toPromptRunRecord(row: execution_runs): PromptRunRecord {
	return {
		runId: row.id,
		userId: row.user_id,
		status: row.status === "waiting_user" ? "failed" : row.status,
		startedAt: row.started_at,
		...(row.finished_at ? { finishedAt: row.finished_at } : {}),
		...(row.output ? { output: row.output } : {}),
		...(row.error ? { error: row.error } : {}),
		projectId: row.project_id,
		...(row.task_id ? { taskId: row.task_id } : {}),
		title: row.title,
		prompt: row.prompt ?? "",
		...(row.original_prompt ? { originalPrompt: row.original_prompt } : {}),
		...(row.source ? { source: row.source } : {}),
		...(row.input_kind ? { inputKind: row.input_kind } : {}),
		...(row.cli ? { cli: row.cli } : {}),
		...(row.model ? { model: row.model } : {}),
		...(row.effort ? { effort: row.effort } : {}),
		...(row.parent_run_id ? { parentRunId: row.parent_run_id } : {}),
		...(row.cli_session_id ? { cliSessionId: row.cli_session_id } : {}),
	};
}

// Um só parser cobre o acompanhamento e o desfecho: o que sai do processo vira passo na tela na hora
// e, no fim, o mesmo estado entrega o texto final e o id de sessão que permite continuar a conversa.
function createRunStream(runId: string, cli: InvokeCli) {
	const parser = createAgentStreamParser(cli);
	let tail = "";
	let pending: AgentStep[] = [];

	function collect(steps: AgentStep[]) {
		if (steps.length === 0) {
			return;
		}
		pending = mergeAgentSteps(pending, steps);
		tail =
			`${tail}${steps.map((step) => `${step.label}${step.detail ? `: ${step.detail}` : ""}\n`).join("")}`.slice(
				-LIVE_OUTPUT_MAX_CHARS,
			);
	}

	function flushToClients() {
		if (pending.length === 0) {
			return;
		}
		const steps = pending;
		pending = [];
		void emit({ runId, status: "step", steps, output: tail });
	}

	const timer = setInterval(flushToClients, LIVE_OUTPUT_INTERVAL_MS);
	timer.unref();
	let stopped = false;

	return {
		push(chunk: string) {
			collect(applyRunStepPatches(runId, parser.push(chunk)));
		},
		// Idempotente: o desfecho normal encerra o fluxo para ler o resultado e o `finally` encerra de
		// novo quando o processo morre antes disso.
		stop() {
			if (!stopped) {
				stopped = true;
				collect(applyRunStepPatches(runId, parser.flush()));
				flushToClients();
				clearInterval(timer);
			}

			return parser.result();
		},
	};
}

async function assertNoRunningExecution(projectId: string, taskId: string) {
	const running = await dbExecutionRuns.listRunningTaskIds(projectId, [taskId]);
	if (running.length > 0) {
		throw new ORPCError("CONFLICT", {
			message:
				"Esta tarefa já tem uma execução em andamento. Aguarde ela terminar ou cancele antes de disparar outra.",
		});
	}
}

async function claimTaskExecution(input: { projectId: string; taskId: string; runId: string }) {
	const competing = await dbExecutionRuns.listRunningForTask(input.projectId, input.taskId);
	const own = competing.find((run) => run.id === input.runId);
	if (!own) {
		return;
	}

	const loses = competing.some(
		(run) =>
			run.id !== own.id &&
			(run.started_at < own.started_at || (run.started_at === own.started_at && run.id < own.id)),
	);
	if (loses) {
		throw new ORPCError("CONFLICT", {
			message:
				"Esta tarefa já tem uma execução em andamento. Aguarde ela terminar ou cancele antes de disparar outra.",
		});
	}
}

async function assertTaskStorageStable(projectId: string, taskId: string) {
	const [project, task] = await Promise.all([
		dbProjects.getById(projectId),
		dbTasks.getById(taskId),
	]);
	if (!project || !task) {
		throw new ORPCError("NOT_FOUND", { message: "A tarefa desta execução não existe mais" });
	}

	return withProjectStorageLock(
		{ projectId: project.id, projectRoute: project.main_route, task },
		() => dbTasks.getById(task.id),
	);
}

async function finishRun(params: {
	runId: string;
	userId: number;
	status: "done" | "failed" | "timeout" | "cancelled";
	title: string;
	output?: string;
	error?: string;
	cliSessionId?: string;
}) {
	const finished = await dbExecutionRuns.finishIfRunning(params.runId, {
		status: params.status,
		...(params.output ? { output: params.output } : {}),
		...(params.error ? { error: params.error } : {}),
	});
	if (!finished) {
		return;
	}

	await emit({
		runId: params.runId,
		status: params.status,
		...(params.output ? { output: params.output } : {}),
		...(params.error ? { error: params.error } : {}),
	});

	void PushNotifications.send(params.userId, {
		title:
			params.status === "done"
				? "Execução concluída"
				: params.status === "cancelled"
					? "Execução cancelada"
					: "Execução precisa de atenção",
		body: params.status === "done" ? params.title : (params.error ?? params.title),
		url: `/executar/${params.runId}`,
		tag: `execution-${params.runId}`,
	}).catch(() => {});
}

type RunProcessParams = {
	runId: string;
	userId: number;
	title: string;
	cwd: string;
	cmd: string[];
	controller: AbortController;
	cli: InvokeCli;
};

async function runInBackground(params: RunProcessParams): Promise<void> {
	const { runId, cwd, cmd } = params;
	const stream = createRunStream(runId, params.cli);
	let parsed: ReturnType<typeof stream.stop> = {};

	try {
		const { stdout, stderr, exitCode, timedOut, cancelled } = await spawnCapture({
			cmd,
			cwd,
			timeoutMs: RUN_TIMEOUT_MS,
			env: HEADLESS_ENV,
			signal: params.controller.signal,
			onStdout: stream.push,
		});
		parsed = stream.stop();

		if (cancelled) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				status: "cancelled",
				error: "A execução foi cancelada.",
			});
			return;
		}

		if (timedOut) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				status: "timeout",
				error: "A execução excedeu o tempo limite de 45 minutos.",
			});
			return;
		}

		const result = { output: parsed.output ?? stdout, cliSessionId: parsed.sessionId };

		if (exitCode !== 0) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				status: "failed",
				error: failureMessage(exitCode, stderr),
				output: truncateOutput(result.output),
				...(result.cliSessionId ? { cliSessionId: result.cliSessionId } : {}),
			});
			return;
		}

		await finishRun({
			runId,
			userId: params.userId,
			title: params.title,
			status: "done",
			output: truncateOutput(result.output),
			...(result.cliSessionId ? { cliSessionId: result.cliSessionId } : {}),
		});
	} catch (err) {
		const sessionId = stream.stop().sessionId;
		await finishRun({
			runId,
			userId: params.userId,
			title: params.title,
			status: "failed",
			error: err instanceof Error ? err.message : "Erro inesperado na execução",
			...(sessionId ? { cliSessionId: sessionId } : {}),
		});
	} finally {
		stream.stop();
		releaseRun(runId);
	}
}

async function runViaKwTerminal(params: RunProcessParams): Promise<void> {
	const settings = await getSystemSettings().catch(() => null);
	if (settings?.terminalMultiplexer !== "kw-terminal") {
		return runInBackground(params);
	}

	const handle = await openExecutionTerminal({
		runId: params.runId,
		title: params.title,
		cwd: params.cwd,
		cmd: params.cmd,
	}).catch(() => null);
	if (!handle) {
		return runInBackground(params);
	}

	return runInTerminal(params, handle);
}

async function runInTerminal(
	params: RunProcessParams,
	handle: ExecutionTerminalHandle,
): Promise<void> {
	const { runId } = params;
	const stream = createRunStream(runId, params.cli);
	const decoder = new TextDecoder();
	const startedAt = Date.now();
	let offset = 0;
	let stdout = "";
	let exitCode: number | null = null;
	let cancelled = false;
	let timedOut = false;
	let tabClosed = false;
	let lastTabCheck = startedAt;

	async function drain() {
		const chunk = await readNewLogBytes({ path: handle.logPath, offset, decoder });
		offset = chunk.next;
		if (chunk.text) {
			stdout += chunk.text;
			stream.push(chunk.text);
		}
	}

	try {
		while (true) {
			await drain();

			const exitText = await Bun.file(handle.exitPath)
				.text()
				.catch(() => "");
			if (exitText.trim()) {
				await drain();
				exitCode = Number.parseInt(exitText.trim(), 10);
				break;
			}

			if (params.controller.signal.aborted) {
				cancelled = true;
				break;
			}

			if (Date.now() - startedAt > RUN_TIMEOUT_MS) {
				timedOut = true;
				break;
			}

			if (Date.now() - lastTabCheck > 5_000) {
				lastTabCheck = Date.now();
				if (!(await handle.tabAlive())) {
					tabClosed = true;
					break;
				}
			}

			await Bun.sleep(400);
		}

		const parsed = stream.stop();

		if (cancelled || timedOut) {
			await handle.closeTab();
		}

		if (cancelled) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				status: "cancelled",
				error: "A execução foi cancelada.",
			});
			return;
		}

		if (timedOut) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				status: "timeout",
				error: "A execução excedeu o tempo limite de 45 minutos.",
			});
			return;
		}

		const result = { output: parsed.output ?? stdout, cliSessionId: parsed.sessionId };

		if (tabClosed) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				status: "cancelled",
				error: "A tab da execução foi fechada no kw-terminal antes do fim.",
				output: truncateOutput(result.output),
				...(result.cliSessionId ? { cliSessionId: result.cliSessionId } : {}),
			});
			return;
		}

		if (exitCode !== 0) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				status: "failed",
				error: failureMessage(exitCode ?? 1, stdout.slice(-MAX_ERROR_DETAIL_CHARS)),
				output: truncateOutput(result.output),
				...(result.cliSessionId ? { cliSessionId: result.cliSessionId } : {}),
			});
			return;
		}

		await finishRun({
			runId,
			userId: params.userId,
			title: params.title,
			status: "done",
			output: truncateOutput(result.output),
			...(result.cliSessionId ? { cliSessionId: result.cliSessionId } : {}),
		});
	} catch (err) {
		const sessionId = stream.stop().sessionId;
		await finishRun({
			runId,
			userId: params.userId,
			title: params.title,
			status: "failed",
			error: err instanceof Error ? err.message : "Erro inesperado na execução",
			...(sessionId ? { cliSessionId: sessionId } : {}),
		});
	} finally {
		stream.stop();
		releaseRun(runId);
		void handle.cleanup();
	}
}

export async function startPromptRun(params: {
	userId: number;
	clientRequestId: string;
	projectId: string;
	taskId?: string;
	createTaskTitle?: string;
	title: string;
	cwd: string;
	prompt: string;
	originalPrompt?: string;
	source: "merge_action" | "automation";
	interactionMode: "unattended";
	inputKind: "text" | "audio_transcript" | "task_flow";
	cli: InvokeCli;
	permissionMode?: string;
	agent?: string;
	model?: string;
	effort?: string;
	approvalMode?: string;
}) {
	const requestFingerprint = JSON.stringify({
		projectId: params.projectId,
		taskId: params.taskId,
		createTaskTitle: params.createTaskTitle,
		prompt: params.prompt,
		originalPrompt: params.originalPrompt ?? params.prompt,
		source: params.source,
		interactionMode: params.interactionMode,
		inputKind: params.inputKind,
		cli: params.cli,
		permissionMode: params.permissionMode,
		agent: params.agent,
		model: params.model,
		effort: params.effort,
		approvalMode: params.approvalMode,
	});
	const existing = await dbExecutionRuns.getByRequestIdForUser(
		params.clientRequestId,
		params.userId,
	);
	if (existing) {
		if (existing.request_fingerprint !== requestFingerprint) {
			throw new ORPCError("CONFLICT", {
				message: "A identificação desta requisição já foi usada por outra execução",
			});
		}

		return { runId: existing.id };
	}

	if (params.taskId) {
		await assertNoRunningExecution(params.projectId, params.taskId);
	}

	const runId = crypto.randomUUID();
	const startedAt = Date.now();

	const created = await dbExecutionRuns
		.create({
			id: runId,
			user_id: params.userId,
			project_id: params.projectId,
			client_request_id: params.clientRequestId,
			request_fingerprint: requestFingerprint,
			create_task_title: params.createTaskTitle,
			...(params.taskId ? { task_id: params.taskId } : {}),
			kind: "prompt",
			title: params.title,
			status: "running",
			prompt: params.prompt,
			original_prompt: params.originalPrompt ?? params.prompt,
			source: params.source,
			interaction_mode: params.interactionMode,
			input_kind: params.inputKind,
			cli: params.cli,
			permission_mode: params.permissionMode,
			agent: params.agent,
			model: params.model,
			effort: params.effort,
			approval_mode: params.approvalMode,
			started_at: startedAt,
			updated_at: startedAt,
			heartbeat_at: startedAt,
		})
		.catch(async (error) => {
			const concurrent = await dbExecutionRuns.getByRequestIdForUser(
				params.clientRequestId,
				params.userId,
			);
			if (concurrent) {
				return concurrent;
			}
			// O índice único de sessão em andamento é a defesa contra dois turnos simultâneos no mesmo
			// histórico do CLI. Sem tradução, o usuário recebia o texto cru da constraint do SQLite.
			throw error;
		});
	if (created.id !== runId) {
		if (created.request_fingerprint !== requestFingerprint) {
			throw new ORPCError("CONFLICT", {
				message: "A identificação desta requisição já foi usada por outra execução",
			});
		}
		return { runId: created.id };
	}
	if (params.taskId) {
		await claimTaskExecution({
			projectId: params.projectId,
			taskId: params.taskId,
			runId,
		}).catch(async (error) => {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				status: "failed",
				error: error instanceof Error ? error.message : "Não foi possível iniciar a execução",
			});
			throw error;
		});
	}
	const controller = trackRun(runId);

	let taskId = params.taskId;
	let title = params.title;
	let prompt = params.prompt;
	if (params.createTaskTitle !== undefined) {
		if (controller.signal.aborted) {
			await finishRun({
				runId,
				userId: params.userId,
				title,
				status: "cancelled",
				error: "A execução foi cancelada.",
			});
			releaseRun(runId);
			return { runId };
		}
		const task = await createTask({
			projectId: params.projectId,
			...(params.createTaskTitle ? { title: params.createTaskTitle } : {}),
			complexity: "medio",
			seed: true,
		}).catch(async (error) => {
			await finishRun({
				runId,
				userId: params.userId,
				title,
				status: "failed",
				error: error instanceof Error ? error.message : "Não foi possível criar a tarefa",
			});
			return null;
		});
		if (!task) {
			releaseRun(runId);
			return { runId };
		}

		taskId = task.id;
		title = task.title ?? title;
		const kwLine = `${params.cli === "codex" ? "$kw" : "/kw"} ${task.folder_path}/index.md`;
		prompt = params.createTaskTitle
			? `${kwLine}\n\n${params.prompt}`
			: `${kwLine}\n\n${taskAutoTitleInstruction(task.id)}\n\n${params.prompt}`;
		// Zerar `create_task_title` no mesmo update que grava o vínculo deixa a intenção "criar tarefa"
		// consumida: um retry deste run reaproveita a tarefa em vez de criar uma segunda com o mesmo
		// título.
		const linked = await dbExecutionRuns
			.update(runId, { task_id: taskId, title, prompt, create_task_title: null })
			.catch(async (error) => {
				const rollbackError = await rollbackCreatedTask(task).catch((caught) => caught);
				const message =
					error instanceof Error ? error.message : "Não foi possível associar a tarefa";
				await finishRun({
					runId,
					userId: params.userId,
					title,
					status: "failed",
					error:
						rollbackError instanceof Error
							? `${message}. A compensação também falhou: ${rollbackError.message}`
							: message,
				});
				return null;
			});
		if (!linked) {
			releaseRun(runId);
			return { runId };
		}
		if (controller.signal.aborted) {
			const rollbackError = await rollbackCreatedTask(task).catch((caught) => caught);
			const unlinkError = await dbExecutionRuns
				.update(runId, { task_id: null })
				.catch((caught) => caught);
			const compensationError = rollbackError instanceof Error ? rollbackError : unlinkError;
			await finishRun({
				runId,
				userId: params.userId,
				title,
				status: "cancelled",
				error:
					compensationError instanceof Error
						? `A execução foi cancelada, mas a tarefa não pôde ser removida: ${compensationError.message}`
						: "A execução foi cancelada.",
			});
			releaseRun(runId);
			return { runId };
		}
	}
	if (controller.signal.aborted) {
		await finishRun({
			runId,
			userId: params.userId,
			title,
			status: "cancelled",
			error: "A execução foi cancelada.",
		});
		releaseRun(runId);
		return { runId };
	}

	if (taskId) {
		const stable = await assertTaskStorageStable(params.projectId, taskId).catch(async (error) => {
			await finishRun({
				runId,
				userId: params.userId,
				title,
				status: "failed",
				error:
					error instanceof Error
						? error.message
						: "O storage da tarefa não pôde ser verificado antes da execução",
			});
			return null;
		});
		if (!stable) {
			releaseRun(runId);
			return { runId };
		}
	}

	void emit({ runId, status: "started" });

	const cmd =
		params.cli === "codex"
			? buildCodexExecArgs({
					prompt,
					cwd: params.cwd,
					model: params.model,
					effort: params.effort,
					approvalMode: params.approvalMode ?? "bypass",
					persistSession: false,
					structuredOutput: true,
				})
			: buildClaudeArgv({
					prompt,
					headless: true,
					permissionMode: params.permissionMode ?? "acceptEdits",
					agent: params.agent,
					model: params.model,
					effort: params.effort,
				});

	const runParams = {
		runId,
		userId: params.userId,
		title,
		cwd: params.cwd,
		cmd,
		controller,
		cli: params.cli,
	};

	void runViaKwTerminal(runParams);

	return { runId };
}

export async function reconcileStaleRuns() {
	const now = Date.now();
	const stale = await dbExecutionRuns.listStale({
		heartbeatBefore: now - HEARTBEAT_STALE_MS,
		promptStartedBefore: now - RUN_TIMEOUT_MS,
		flowStartedBefore: now - FLOW_TIMEOUT_MS,
	});

	for (const run of stale) {
		const timeoutMs = run.kind === "flow" ? FLOW_TIMEOUT_MS : RUN_TIMEOUT_MS;
		const overdue = run.started_at < now - timeoutMs;
		const tracked = getActiveRun(run.id);
		if (tracked && !overdue) {
			continue;
		}

		tracked?.abort();
		releaseRun(run.id);
		const status = overdue ? "timeout" : "failed";
		const error = overdue
			? `A execução excedeu o tempo limite de ${Math.round(timeoutMs / 60_000)} minutos.`
			: "O executor caiu durante a execução. O agente pode ter continuado a trabalhar no repositório: confira o projeto antes de repetir.";

		if (run.kind === "flow") {
			await finishFlowRunExternally(run, { status, message: error }).catch((caught) => {
				console.error("[PromptRun] Falha ao encerrar fluxo sem sinal de vida:", caught);
			});
			continue;
		}

		await finishRun({
			runId: run.id,
			userId: run.user_id,
			title: run.title,
			status,
			error,
		}).catch((caught) => {
			console.error("[PromptRun] Falha ao encerrar execução sem sinal de vida:", caught);
		});
	}

	return stale.length;
}

export function startRunReconciler() {
	const timer = setInterval(() => {
		void reconcileStaleRuns().catch((error) => {
			console.error("[PromptRun] Falha ao reconciliar execuções:", error);
		});
	}, RECONCILE_INTERVAL_MS);
	timer.unref();

	return reconcileStaleRuns();
}

export async function getPromptRun(runId: string, userId: number) {
	const record = await dbExecutionRuns.getDetailedByIdForUser(runId, userId);
	return record
		? Object.assign(toPromptRunRecord(record), {
				projectName: record.project_name ?? "Projeto removido",
				taskTitle: record.task_title ?? undefined,
				taskFolderPath: record.task_folder_path ?? undefined,
				canContinue: false,
			})
		: null;
}

// A conversa é o que o usuário enxerga no celular: os turnos em ordem, cada um com o que foi pedido,
// o que o agente respondeu e os passos que ainda estiverem em memória. Um run sem sessão (Codex antes
// do primeiro desfecho) é uma conversa de um turno só.
export async function getPromptThread(runId: string, userId: number) {
	const run = await dbExecutionRuns.getDetailedByIdForUser(runId, userId);
	if (!run) {
		return null;
	}

	const rows = run.cli_session_id
		? await dbExecutionRuns.listThreadForUser(run.cli_session_id, userId)
		: [run];
	const turns = rows.map((row) =>
		Object.assign(toPromptRunRecord(row), {
			projectName: row.project_name ?? "Projeto removido",
			taskTitle: row.task_title ?? undefined,
			steps: getRunSteps(row.id),
		}),
	);
	const last = turns.at(-1) ?? toPromptRunRecord(run);
	// Retomar a sessão do CLI parte do último turno que chegou ao fim: se o turno mais recente falhou
	// ou foi interrompido, a conversa continua do que ficou de pé em vez de morrer ali.
	return {
		threadId: run.cli_session_id ?? run.id,
		projectId: run.project_id,
		projectName: run.project_name ?? "Projeto removido",
		...(run.task_id ? { taskId: run.task_id } : {}),
		...(run.task_title ? { taskTitle: run.task_title } : {}),
		title: run.title,
		cli: run.cli ?? "claude",
		...(run.model ? { model: run.model } : {}),
		latestRunId: last.runId,
		status: last.status,
		canContinue: false,
		turns,
	};
}

export async function listPromptRuns(userId: number, limit: number) {
	const rows = await dbExecutionRuns.listForUser(userId, limit);
	return rows.map((row) =>
		Object.assign(toPromptRunRecord(row), {
			projectName: row.project_name ?? "Projeto removido",
			taskTitle: row.task_title ?? undefined,
		}),
	);
}

export async function cancelPromptRun(runId: string, userId: number) {
	const run = await dbExecutionRuns.getByIdForUser(runId, userId);
	if (!run) {
		return null;
	}
	if (run.status !== "running") {
		return toPromptRunRecord(run);
	}

	const tracked = getActiveRun(runId);
	if (tracked) {
		tracked.abort();
		return toPromptRunRecord(run);
	}

	// Sem processo neste executor o abort não tem efeito: o run pertencia a um executor que morreu.
	// Encerrar o registro na hora evita um "Cancelar" que não muda nada na tela.
	if (run.kind === "flow") {
		await finishFlowRunExternally(run, {
			status: "cancelled",
			message: "O fluxo foi cancelado: o executor que o iniciou não está mais no ar.",
		});

		return toPromptRunRecord((await dbExecutionRuns.getByIdForUser(runId, userId)) ?? run);
	}

	await finishRun({
		runId,
		userId,
		title: run.title,
		status: "cancelled",
		error: "A execução foi cancelada — o executor que a iniciou não está mais no ar.",
	});

	return toPromptRunRecord((await dbExecutionRuns.getByIdForUser(runId, userId)) ?? run);
}
