import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjectRoutes } from "../db/project-routes";
import { dbProjects } from "../db/projects";
import {
	listProjectActions,
	readGitSummary,
	runActionInBackground,
} from "../helpers/project-actions";
import { assertAdminUser } from "../helpers/redeploy";
import { Terminal } from "../helpers/terminal/service";
import { ProjectActionRunSchema, ProjectActionsListSchema } from "../schemas";

async function loadActions(projectId: string) {
	const project = await dbProjects.getById(projectId);
	if (!project) {
		throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
	}
	const routes = await dbProjectRoutes.getByProject(project.id);
	return { project, actions: await listProjectActions(project, routes) };
}

export const projectActionsRouter = {
	list: protectedProcedure.input(ProjectActionsListSchema).handler(async ({ input }) => {
		const { project, actions } = await loadActions(input.projectId);
		return {
			git: await readGitSummary(project.main_route),
			actions: actions.map(({ cwd: _cwd, ...action }) => action),
		};
	}),

	run: protectedProcedure.input(ProjectActionRunSchema).handler(async ({ input, context }) => {
		assertAdminUser(context.user.user_type);
		const { project, actions } = await loadActions(input.projectId);
		const action = actions.find((item) => item.id === input.actionId);
		if (!action) {
			throw new ORPCError("NOT_FOUND", { message: "Ação não encontrada" });
		}

		if (input.mode === "terminal") {
			await Terminal.openForRoute({
				projectId: project.id,
				projectName: project.name,
				routeId: action.routeId ?? action.id,
				routeName: action.label,
				routePath: action.cwd,
				...(action.command ? { command: action.command } : {}),
			});
			return { mode: "terminal" as const };
		}

		return { mode: "background" as const, ...(await runActionInBackground(action)) };
	}),
};
