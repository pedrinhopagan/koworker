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

	execute: protectedProcedure.input(PromptExecuteSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project?.main_route) {
			throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
		}

		return startPromptRun({
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

	runStatus: protectedProcedure
		.input(PromptRunIdSchema)
		.handler(({ input }) => getPromptRun(input.runId)),
};
