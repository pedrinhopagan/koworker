import { type InvokeCli } from "@/constants/invoke";
import { PubSub, type PromptRunEvent } from "../pubsub";
import { spawnCapture } from "./spawn";

const RUN_TIMEOUT_MS = 45 * 60_000;
const MAX_OUTPUT_CHARS = 20_000;
const MAX_RUNS = 20;

export type PromptRunStatus = "running" | "done" | "failed" | "timeout";

export type PromptRunRecord = {
	runId: string;
	status: PromptRunStatus;
	startedAt: number;
	finishedAt?: number;
	output?: string;
	error?: string;
	projectId: string;
	prompt: string;
};

const runs = new Map<string, PromptRunRecord>();
const runOrder: string[] = [];

function truncateOutput(value: string): string {
	if (value.length <= MAX_OUTPUT_CHARS) {
		return value;
	}
	return `${value.slice(0, MAX_OUTPUT_CHARS)}\n… (truncado)`;
}

function trimRuns(): void {
	while (runOrder.length > MAX_RUNS) {
		const oldest = runOrder.shift();
		if (oldest) {
			runs.delete(oldest);
		}
	}
}

async function emit(event: PromptRunEvent): Promise<void> {
	await PubSub.publish("promptRun", event.runId, event);
}

function buildClaudeCmd(params: {
	prompt: string;
	permissionMode?: string;
	agent?: string;
	model?: string;
	effort?: string;
}): string[] {
	const permissionFlags =
		params.permissionMode === "bypass"
			? ["--dangerously-skip-permissions"]
			: ["--permission-mode", params.permissionMode ?? "acceptEdits"];

	return [
		"claude",
		"-p",
		params.prompt,
		...(params.agent ? ["--agent", params.agent] : []),
		...(params.model ? ["--model", params.model] : []),
		...(params.effort ? ["--effort", params.effort] : []),
		...permissionFlags,
	];
}

function buildCodexCmd(params: {
	prompt: string;
	cwd: string;
	model?: string;
	effort?: string;
	approvalMode?: string;
}): string[] {
	const cmd = ["codex", "exec"];

	if (params.model) {
		cmd.push("-m", params.model);
	}
	if (params.effort) {
		cmd.push("-c", `model_reasoning_effort=${params.effort}`);
	}

	cmd.push("--ephemeral", "--skip-git-repo-check", "-C", params.cwd);

	if (params.approvalMode === "bypass") {
		cmd.push("--dangerously-bypass-approvals-and-sandbox");
	} else if (params.approvalMode === "fullAuto") {
		cmd.push("--full-auto");
	} else if (params.approvalMode === "readOnly") {
		cmd.push("--sandbox", "read-only");
	}

	cmd.push(params.prompt);
	return cmd;
}

async function runInBackground(params: {
	runId: string;
	cwd: string;
	cmd: string[];
}): Promise<void> {
	const { runId, cwd, cmd } = params;

	try {
		const { stdout, exitCode, timedOut } = await spawnCapture({
			cmd,
			cwd,
			timeoutMs: RUN_TIMEOUT_MS,
		});

		const record = runs.get(runId);
		if (!record) {
			return;
		}

		if (timedOut) {
			record.status = "timeout";
			record.error = "A execução excedeu o tempo limite de 45 minutos.";
			record.finishedAt = Date.now();
			await emit({
				runId,
				status: "timeout",
				error: record.error,
			});
			return;
		}

		if (exitCode !== 0) {
			record.status = "failed";
			record.error = `A execução falhou (código ${exitCode}).`;
			record.output = truncateOutput(stdout);
			record.finishedAt = Date.now();
			await emit({
				runId,
				status: "failed",
				error: record.error,
				output: record.output,
			});
			return;
		}

		record.status = "done";
		record.output = truncateOutput(stdout);
		record.finishedAt = Date.now();
		await emit({
			runId,
			status: "done",
			output: record.output,
		});
	} catch (err) {
		const record = runs.get(runId);
		if (!record) {
			return;
		}
		record.status = "failed";
		record.error = err instanceof Error ? err.message : "Erro inesperado na execução";
		record.finishedAt = Date.now();
		await emit({
			runId,
			status: "failed",
			error: record.error,
		});
	}
}

export function startPromptRun(params: {
	projectId: string;
	cwd: string;
	prompt: string;
	cli: InvokeCli;
	permissionMode?: string;
	agent?: string;
	model?: string;
	effort?: string;
	approvalMode?: string;
}): { runId: string } {
	const runId = crypto.randomUUID();
	const startedAt = Date.now();

	const record: PromptRunRecord = {
		runId,
		status: "running",
		startedAt,
		projectId: params.projectId,
		prompt: params.prompt,
	};

	runs.set(runId, record);
	runOrder.push(runId);
	trimRuns();

	void emit({ runId, status: "started" });

	const cmd =
		params.cli === "codex"
			? buildCodexCmd({
					prompt: params.prompt,
					cwd: params.cwd,
					model: params.model,
					effort: params.effort,
					approvalMode: params.approvalMode,
				})
			: buildClaudeCmd({
					prompt: params.prompt,
					permissionMode: params.permissionMode,
					agent: params.agent,
					model: params.model,
					effort: params.effort,
				});

	void runInBackground({ runId, cwd: params.cwd, cmd });

	return { runId };
}

export function getPromptRun(runId: string): PromptRunRecord | null {
	return runs.get(runId) ?? null;
}
