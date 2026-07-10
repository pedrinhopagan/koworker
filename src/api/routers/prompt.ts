import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { getPromptRun, startPromptRun } from "../helpers/prompt-run";
import { runPromptAutofill } from "../helpers/prompt-autofill";
import { PromptAutofillSchema, PromptExecuteSchema, PromptRunIdSchema } from "../schemas";

export const promptRouter = {
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
			projectId: input.projectId,
			taskId: input.taskId,
			title: task?.title ?? project.name,
			cwd: project.main_route,
			prompt: input.prompt,
			cli: input.cli,
			permissionMode: input.permissionMode,
			agent: input.agent,
			model: input.model,
			effort: input.effort,
			approvalMode: input.approvalMode,
		});
	}),

	runStatus: protectedProcedure.input(PromptRunIdSchema).handler(async ({ input, context }) => {
		const record = await getPromptRun(input.runId, context.user.id);
		if (!record) {
			throw new ORPCError("NOT_FOUND", { message: "Execução não encontrada" });
		}
		return record;
	}),
};
