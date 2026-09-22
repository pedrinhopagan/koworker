import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjectRoutes } from "../db/project-routes";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { Terminal } from "../helpers/terminal/service";
import { killStrayAgentBrowsers } from "../helpers/terminal/stray";
import { PubSub } from "../pubsub";
import {
	CloseProjectSessionSchema,
	CloseTaskWindowSchema,
	FocusAgentSchema,
	OpenForRouteSchema,
	OpenForTaskSchema,
} from "../schemas/terminal";

async function projectOrThrow(projectId: string) {
	const project = await dbProjects.getById(projectId);
	if (!project) {
		throw new ORPCError("NOT_FOUND", { message: "Projeto não encontrado" });
	}
	return project;
}

export const terminalRouter = {
	focusAgent: protectedProcedure.input(FocusAgentSchema).handler(async ({ input }) => {
		const project = input.projectId ? await projectOrThrow(input.projectId) : null;

		return Terminal.focusAgent({
			cli: input.cli,
			...(project
				? { projectId: project.id, projectName: project.name, mainRoute: project.main_route }
				: {}),
		});
	}),

	openForTask: protectedProcedure.input(OpenForTaskSchema).handler(async ({ input }) => {
		const project = await projectOrThrow(input.projectId);
		return Terminal.openForTask({
			...input,
			projectName: project.name,
			mainRoute: project.main_route,
		});
	}),

	openForRoute: protectedProcedure.input(OpenForRouteSchema).handler(async ({ input }) => {
		const [project, route] = await Promise.all([
			projectOrThrow(input.projectId),
			dbProjectRoutes.getById(input.routeId),
		]);
		if (!route || route.project_id !== project.id) {
			throw new ORPCError("NOT_FOUND", { message: "Rota não encontrada" });
		}
		return Terminal.openForRoute({
			...input,
			projectName: project.name,
			routeName: route.name,
			routePath: route.route,
			...(route.command ? { command: route.command } : {}),
		});
	}),

	closeProjectSession: protectedProcedure
		.input(CloseProjectSessionSchema)
		.handler(async ({ input }) => {
			const project = await projectOrThrow(input.projectId);
			await Terminal.closeProjectSession({
				projectId: project.id,
				projectName: project.name,
			});
			return { ok: true };
		}),

	closeTaskWindow: protectedProcedure.input(CloseTaskWindowSchema).handler(async ({ input }) => {
		const [project, task] = await Promise.all([
			projectOrThrow(input.projectId),
			dbTasks.getById(input.taskId),
		]);
		if (!task || task.project_id !== project.id) {
			throw new ORPCError("NOT_FOUND", { message: "Tarefa não encontrada" });
		}

		await Terminal.closeTaskWindow({
			projectId: project.id,
			projectName: project.name,
			taskId: task.id,
			taskTitle: task.title ?? "",
		});
		return { ok: true };
	}),

	sweepAllActive: protectedProcedure.handler(async () => {
		const projects = await dbProjects.getAll();
		const closed = await Terminal.closeInvocationSessions({
			projects: projects.map((project) => ({ id: project.id, name: project.name })),
		});
		await killStrayAgentBrowsers();
		return { closed, strayKilled: true };
	}),
};

export const terminalWsRouter = {
	events: protectedProcedure.handler(({ signal }) => PubSub.terminal.subscribe(signal)),
};
