import { type InvokeCli } from "@/constants/invoke";
import { buildClaudeArgv } from "@/lib/claude-command";
import { buildCodexExecArgs } from "@/lib/codex-command";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { execution_runs } from "../db/connection";
import { dbExecutionRuns } from "../db/execution-runs";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { PubSub, type PromptRunEvent } from "../pubsub";
import { finishFlowRunExternally, FLOW_TIMEOUT_MS } from "./flow";
import { PushNotifications } from "./push-notifications";
import { getActiveRun, HEARTBEAT_STALE_MS, releaseRun, trackRun } from "./run-registry";
import { spawnCapture } from "./spawn";
import { createTask, rollbackCreatedTask } from "./task-creation";
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

const CodexEventSchema = z.object({
	type: z.string(),
	thread_id: z.string().optional(),
	item: z
		.object({
			type: z.string(),
			text: z.string().optional(),
		})
		.optional(),
});

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

export function parseCodexOutput(stdout: string) {
	const messages: string[] = [];
	let cliSessionId: string | undefined;

	for (const line of stdout.split("\n")) {
		if (!line.trim()) {
			continue;
		}

		let json: unknown;
		try {
			json = JSON.parse(line);
		} catch {
			continue;
		}
		const event = CodexEventSchema.safeParse(json);
		if (!event.success) {
			continue;
		}
		if (event.data.type === "thread.started" && event.data.thread_id) {
			cliSessionId = event.data.thread_id;
		}
		if (
			event.data.type === "item.completed" &&
			event.data.item?.type === "agent_message" &&
			event.data.item.text
		) {
			messages.push(event.data.item.text);
		}
	}

	return {
		output: messages.at(-1) ?? stdout,
		...(cliSessionId ? { cliSessionId } : {}),
	};
}

function liveTextFromCodexLine(line: string): string {
	if (!line.trim()) {
		return "";
	}

	let json: unknown;
	try {
		json = JSON.parse(line);
	} catch {
		return "";
	}
	const event = CodexEventSchema.safeParse(json);
	if (!event.success) {
		return "";
	}

	return `${event.data.item?.text ?? event.data.type}\n`;
}

function createOutputStreamer(runId: string, cli: InvokeCli) {
	let pendingLine = "";
	let tail = "";
	let dirty = false;

	const timer = setInterval(() => {
		if (!dirty) {
			return;
		}
		dirty = false;
		void emit({ runId, status: "output", output: tail });
	}, LIVE_OUTPUT_INTERVAL_MS);
	timer.unref();

	function append(text: string) {
		if (!text) {
			return;
		}
		tail = `${tail}${text}`.slice(-LIVE_OUTPUT_MAX_CHARS);
		dirty = true;
	}

	return {
		push(chunk: string) {
			if (cli !== "codex") {
				append(chunk);
				return;
			}

			const lines = `${pendingLine}${chunk}`.split("\n");
			pendingLine = lines.pop() ?? "";
			append(lines.map(liveTextFromCodexLine).join(""));
		},
		stop() {
			clearInterval(timer);
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
		throw new Error("A tarefa desta execução não existe mais");
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
		...(params.cliSessionId ? { cli_session_id: params.cliSessionId } : {}),
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

async function runInBackground(params: {
	runId: string;
	userId: number;
	title: string;
	cwd: string;
	cmd: string[];
	controller: AbortController;
	cli: InvokeCli;
}): Promise<void> {
	const { runId, cwd, cmd } = params;
	const streamer = createOutputStreamer(runId, params.cli);

	try {
		const { stdout, stderr, exitCode, timedOut, cancelled } = await spawnCapture({
			cmd,
			cwd,
			timeoutMs: RUN_TIMEOUT_MS,
			env: HEADLESS_ENV,
			signal: params.controller.signal,
			onStdout: streamer.push,
		});

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

		const result = params.cli === "codex" ? parseCodexOutput(stdout) : { output: stdout };

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
		await finishRun({
			runId,
			userId: params.userId,
			title: params.title,
			status: "failed",
			error: err instanceof Error ? err.message : "Erro inesperado na execução",
		});
	} finally {
		streamer.stop();
		releaseRun(runId);
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
	source: "global_bar" | "execution_route" | "task_flow" | "desktop_terminal";
	interactionMode: "unattended" | "interactive";
	inputKind: "text" | "audio_transcript" | "task_flow";
	cli: InvokeCli;
	permissionMode?: string;
	agent?: string;
	model?: string;
	effort?: string;
	approvalMode?: string;
	parentRunId?: string;
	resumeSessionId?: string;
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
		parentRunId: params.parentRunId,
		resumeSessionId: params.resumeSessionId,
	});
	const existing = await dbExecutionRuns.getByRequestIdForUser(
		params.clientRequestId,
		params.userId,
	);
	if (existing) {
		if (existing.request_fingerprint !== requestFingerprint) {
			throw new Error("A identificação desta requisição já foi usada por outra execução");
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
			...(params.parentRunId ? { parent_run_id: params.parentRunId } : {}),
			...(params.resumeSessionId
				? { cli_session_id: params.resumeSessionId }
				: params.cli === "claude"
					? { cli_session_id: runId }
					: {}),
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
			if (params.resumeSessionId && error instanceof Error && error.message.includes("UNIQUE")) {
				throw new Error("Esta sessão já tem uma continuação em andamento. Aguarde ela terminar.");
			}

			throw error;
		});
	if (created.id !== runId) {
		if (created.request_fingerprint !== requestFingerprint) {
			throw new Error("A identificação desta requisição já foi usada por outra execução");
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
	if (params.createTaskTitle) {
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
			title: params.createTaskTitle,
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
		title = task.title ?? params.createTaskTitle;
		prompt = `${params.cli === "codex" ? "$kw" : "/kw"} ${task.folder_path}/index.md\n\n${params.prompt}`;
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
					persistSession: true,
					structuredOutput: true,
					...(params.resumeSessionId ? { resumeSessionId: params.resumeSessionId } : {}),
				})
			: buildClaudeArgv({
					prompt,
					headless: true,
					permissionMode: params.permissionMode ?? "acceptEdits",
					agent: params.agent,
					model: params.model,
					effort: params.effort,
					...(params.resumeSessionId
						? { resumeSessionId: params.resumeSessionId }
						: { sessionId: runId }),
				});

	void runInBackground({
		runId,
		userId: params.userId,
		title,
		cwd: params.cwd,
		cmd,
		controller,
		cli: params.cli,
	});

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
				canContinue: record.status === "done" && !!record.cli_session_id,
			})
		: null;
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
