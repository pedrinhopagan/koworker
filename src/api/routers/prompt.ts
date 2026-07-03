import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
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

		return startPromptRun({
			userId: String(context.user.id),
			projectId: input.projectId,
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

	runStatus: protectedProcedure.input(PromptRunIdSchema).handler(({ input, context }) => {
		const record = getPromptRun(input.runId, String(context.user.id));
		if (!record) {
			throw new ORPCError("NOT_FOUND", { message: "Execução não encontrada" });
		}
		return record;
	}),
};
