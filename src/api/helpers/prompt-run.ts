import { type InvokeCli } from "@/constants/invoke";
import { buildClaudePrintArgs } from "@/lib/claude-command";
import { buildCodexExecArgs } from "@/lib/codex-command";
import type { execution_runs } from "../db/connection";
import { dbExecutionRuns } from "../db/execution-runs";
import { PubSub, type PromptRunEvent } from "../pubsub";
import { PushNotifications } from "./push-notifications";
import { spawnCapture } from "./spawn";
import { createTask, rollbackCreatedTask } from "./task-creation";

const RUN_TIMEOUT_MS = 45 * 60_000;
const MAX_OUTPUT_CHARS = 20_000;
const activeRuns = new Map<string, AbortController>();

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
};

function truncateOutput(value: string): string {
	if (value.length <= MAX_OUTPUT_CHARS) {
		return value;
	}
	return `${value.slice(0, MAX_OUTPUT_CHARS)}\n… (truncado)`;
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
	};
}

async function finishRun(params: {
	runId: string;
	userId: number;
	status: "done" | "failed" | "timeout" | "cancelled";
	title: string;
	taskId?: string;
	output?: string;
	error?: string;
}) {
	await dbExecutionRuns.update(params.runId, {
		status: params.status,
		finished_at: Date.now(),
		...(params.output ? { output: params.output } : {}),
		...(params.error ? { error: params.error } : {}),
	});

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
		url: `/executar?runId=${params.runId}`,
		tag: `execution-${params.runId}`,
	}).catch(() => {});
}

async function runInBackground(params: {
	runId: string;
	userId: number;
	title: string;
	taskId?: string;
	cwd: string;
	cmd: string[];
	controller: AbortController;
}): Promise<void> {
	const { runId, cwd, cmd } = params;

	try {
		const { stdout, exitCode, timedOut, cancelled } = await spawnCapture({
			cmd,
			cwd,
			timeoutMs: RUN_TIMEOUT_MS,
			env: HEADLESS_ENV,
			signal: params.controller.signal,
		});

		if (cancelled) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				taskId: params.taskId,
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
				taskId: params.taskId,
				status: "timeout",
				error: "A execução excedeu o tempo limite de 45 minutos.",
			});
			return;
		}

		if (exitCode !== 0) {
			await finishRun({
				runId,
				userId: params.userId,
				title: params.title,
				taskId: params.taskId,
				status: "failed",
				error: `A execução falhou (código ${exitCode}).`,
				output: truncateOutput(stdout),
			});
			return;
		}

		await finishRun({
			runId,
			userId: params.userId,
			title: params.title,
			taskId: params.taskId,
			status: "done",
			output: truncateOutput(stdout),
		});
	} catch (err) {
		await finishRun({
			runId,
			userId: params.userId,
			title: params.title,
			taskId: params.taskId,
			status: "failed",
			error: err instanceof Error ? err.message : "Erro inesperado na execução",
		});
	} finally {
		activeRuns.delete(runId);
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
			throw new Error("A identificação desta requisição já foi usada por outra execução");
		}

		return { runId: existing.id };
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
		})
		.catch(async (error) => {
			const concurrent = await dbExecutionRuns.getByRequestIdForUser(
				params.clientRequestId,
				params.userId,
			);
			if (!concurrent) {
				throw error;
			}
			return concurrent;
		});
	if (created.id !== runId) {
		if (created.request_fingerprint !== requestFingerprint) {
			throw new Error("A identificação desta requisição já foi usada por outra execução");
		}
		return { runId: created.id };
	}
	const controller = new AbortController();
	activeRuns.set(runId, controller);

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
			activeRuns.delete(runId);
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
			activeRuns.delete(runId);
			return { runId };
		}

		taskId = task.id;
		title = task.title ?? params.createTaskTitle;
		prompt = `${params.cli === "codex" ? "$kw" : "/kw"} ${task.folder_path}/index.md\n\n${params.prompt}`;
		const linked = await dbExecutionRuns
			.update(runId, { task_id: taskId, title, prompt })
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
			activeRuns.delete(runId);
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
			activeRuns.delete(runId);
			return { runId };
		}
	}
	if (controller.signal.aborted) {
		await finishRun({
			runId,
			userId: params.userId,
			title,
			taskId,
			status: "cancelled",
			error: "A execução foi cancelada.",
		});
		activeRuns.delete(runId);
		return { runId };
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
				})
			: buildClaudePrintArgs({
					prompt,
					permissionMode: params.permissionMode ?? "acceptEdits",
					agent: params.agent,
					model: params.model,
					effort: params.effort,
				});

	void runInBackground({
		runId,
		userId: params.userId,
		title,
		taskId,
		cwd: params.cwd,
		cmd,
		controller,
	});

	return { runId };
}

export async function getPromptRun(runId: string, userId: number) {
	const record = await dbExecutionRuns.getByIdForUser(runId, userId);
	return record ? toPromptRunRecord(record) : null;
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
	if (run.status === "running") {
		activeRuns.get(runId)?.abort();
	}

	return toPromptRunRecord(run);
}
