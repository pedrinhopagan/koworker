import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { dbExecutionRuns } from "../db/execution-runs";
import {
	cancelPromptRun,
	getPromptRun,
	listPromptRuns,
	startPromptRun,
} from "../helpers/prompt-run";
import { runPromptAutofill } from "../helpers/prompt-autofill";
import { transcribeAudio } from "../helpers/audio-transcription";
import {
	PromptAutofillSchema,
	AudioTranscriptionSchema,
	PromptExecuteSchema,
	PromptRunClearSchema,
	PromptRunIdSchema,
	PromptRunListSchema,
	PromptRunRetrySchema,
} from "../schemas";

export const promptRouter = {
	transcribe: protectedProcedure
		.input(AudioTranscriptionSchema)
		.handler(({ input }) => transcribeAudio(input.file)),

	autofill: protectedProcedure
		.input(PromptAutofillSchema)
		.handler(({ input }) => runPromptAutofill(input)),

	execute: protectedProcedure.input(PromptExecuteSchema).handler(async ({ input, context }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project?.main_route) {
			throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
		}
		const task = input.taskId ? await dbTasks.getById(input.taskId) : null;
		if (input.taskId && task?.project_id !== project.id) {
			throw new ORPCError("NOT_FOUND", { message: "Tarefa não encontrada" });
		}

		return startPromptRun({
			userId: context.user.id,
			clientRequestId: input.clientRequestId,
			projectId: input.projectId,
			taskId: input.taskId,
			createTaskTitle: input.createTaskTitle,
			title: task?.title ?? project.name,
			cwd: project.main_route,
			prompt: input.prompt,
			originalPrompt: input.originalPrompt,
			source: input.source,
			interactionMode: input.interactionMode,
			inputKind: input.inputKind,
			cli: input.cli,
			permissionMode: input.permissionMode,
			agent: input.agent,
			model: input.model,
			effort: input.effort,
			approvalMode: input.approvalMode,
		});
	}),

	listRuns: protectedProcedure
		.input(PromptRunListSchema)
		.handler(({ input, context }) => listPromptRuns(context.user.id, input.limit)),

	clearRuns: protectedProcedure.input(PromptRunClearSchema).handler(async ({ input, context }) => ({
		cleared: await dbExecutionRuns.softDeleteFinishedForUser(input.runIds, context.user.id),
	})),

	retry: protectedProcedure.input(PromptRunRetrySchema).handler(async ({ input, context }) => {
		const run = await dbExecutionRuns.getByIdForUser(input.runId, context.user.id);
		if (!run) {
			throw new ORPCError("NOT_FOUND", { message: "Execução não encontrada" });
		}
		const project = await dbProjects.getById(run.project_id);
		if (!project?.main_route) {
			throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
		}
		if (
			!run.prompt ||
			!run.original_prompt ||
			!run.source ||
			!run.interaction_mode ||
			!run.input_kind ||
			!run.cli
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Esta execução antiga não possui dados suficientes para repetir",
			});
		}

		const retryInput = PromptExecuteSchema.parse({
			clientRequestId: input.clientRequestId,
			projectId: run.project_id,
			taskId: run.task_id ?? undefined,
			createTaskTitle: run.task_id ? undefined : (run.create_task_title ?? undefined),
			prompt: run.prompt,
			originalPrompt: run.original_prompt,
			source: run.source,
			interactionMode: run.interaction_mode,
			inputKind: run.input_kind,
			cli: run.cli,
			permissionMode: run.permission_mode ?? undefined,
			agent: run.agent ?? undefined,
			model: run.model ?? undefined,
			effort: run.effort ?? undefined,
			approvalMode: run.approval_mode ?? undefined,
		});

		return startPromptRun({
			...retryInput,
			userId: context.user.id,
			title: run.title,
			cwd: project.main_route,
		});
	}),

	cancel: protectedProcedure.input(PromptRunIdSchema).handler(async ({ input, context }) => {
		const run = await cancelPromptRun(input.runId, context.user.id);
		if (!run) {
			throw new ORPCError("NOT_FOUND", { message: "Execução não encontrada" });
		}
		return run;
	}),

	runStatus: protectedProcedure.input(PromptRunIdSchema).handler(async ({ input, context }) => {
		const record = await getPromptRun(input.runId, context.user.id);
		if (!record) {
			throw new ORPCError("NOT_FOUND", { message: "Execução não encontrada" });
		}
		return record;
	}),
};
