import { type InvokeCli } from "@/constants/invoke";
import { buildClaudePrintArgs } from "@/lib/claude-command";
import { buildCodexExecArgs } from "@/lib/codex-command";
import type { execution_runs } from "../db/connection";
import { dbExecutionRuns } from "../db/execution-runs";
import { PubSub, type PromptRunEvent } from "../pubsub";
import { PushNotifications } from "./push-notifications";
import { spawnCapture } from "./spawn";

const RUN_TIMEOUT_MS = 45 * 60_000;
const MAX_OUTPUT_CHARS = 20_000;

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

export type PromptRunStatus = "running" | "done" | "failed" | "timeout";

export type PromptRunRecord = {
	runId: string;
	userId: number;
	status: PromptRunStatus;
	startedAt: number;
	finishedAt?: number;
	output?: string;
	error?: string;
	projectId: string;
	prompt: string;
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
		prompt: row.prompt ?? "",
	};
}

async function finishRun(params: {
	runId: string;
	userId: number;
	status: "done" | "failed" | "timeout";
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
		title: params.status === "done" ? "Execução concluída" : "Execução precisa de atenção",
		body: params.status === "done" ? params.title : (params.error ?? params.title),
		url: params.taskId ? `/tarefas/${params.taskId}` : "/",
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
}): Promise<void> {
	const { runId, cwd, cmd } = params;

	try {
		const { stdout, exitCode, timedOut } = await spawnCapture({
			cmd,
			cwd,
			timeoutMs: RUN_TIMEOUT_MS,
			env: HEADLESS_ENV,
		});

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
	}
}

export async function startPromptRun(params: {
	userId: number;
	projectId: string;
	taskId?: string;
	title: string;
	cwd: string;
	prompt: string;
	cli: InvokeCli;
	permissionMode?: string;
	agent?: string;
	model?: string;
	effort?: string;
	approvalMode?: string;
}) {
	const runId = crypto.randomUUID();
	const startedAt = Date.now();

	await dbExecutionRuns.create({
		id: runId,
		user_id: params.userId,
		project_id: params.projectId,
		...(params.taskId ? { task_id: params.taskId } : {}),
		kind: "prompt",
		title: params.title,
		status: "running",
		prompt: params.prompt,
		started_at: startedAt,
		updated_at: startedAt,
	});

	void emit({ runId, status: "started" });

	const cmd =
		params.cli === "codex"
			? buildCodexExecArgs({
					prompt: params.prompt,
					cwd: params.cwd,
					model: params.model,
					effort: params.effort,
					approvalMode: params.approvalMode ?? "bypass",
				})
			: buildClaudePrintArgs({
					prompt: params.prompt,
					permissionMode: params.permissionMode ?? "acceptEdits",
					agent: params.agent,
					model: params.model,
					effort: params.effort,
				});

	void runInBackground({
		runId,
		userId: params.userId,
		title: params.title,
		taskId: params.taskId,
		cwd: params.cwd,
		cmd,
	});

	return { runId };
}

export async function getPromptRun(runId: string, userId: number) {
	const record = await dbExecutionRuns.getByIdForUser(runId, userId);
	return record ? toPromptRunRecord(record) : null;
}
