import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjectRoutes } from "../db/project-routes";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { getSystemSettings } from "../helpers/system-settings";
import { Terminal } from "../helpers/terminal/service";
import { killStrayAgentBrowsers } from "../helpers/terminal/stray";
import { PubSub } from "../pubsub";
import {
	CloseProjectSessionSchema,
	CloseTaskWindowSchema,
	FocusAgentSchema,
	InvocationSessionsSchema,
	OpenForRouteSchema,
	OpenForTaskSchema,
} from "../schemas/terminal";

// Fronteira dona da config: lê as settings de SO e resolve o emulador/multiplexador que o serviço usa.
async function terminalConfig() {
	const settings = await getSystemSettings();
	return { template: settings.terminalTemplate, multiplexer: settings.terminalMultiplexer };
}

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
			config: await terminalConfig(),
			cli: input.cli,
			...(project
				? { projectId: project.id, projectName: project.name, mainRoute: project.main_route }
				: {}),
		});
	}),

	openForTask: protectedProcedure.input(OpenForTaskSchema).handler(async ({ input }) => {
		const project = await projectOrThrow(input.projectId);
		return Terminal.openForTask({
			config: await terminalConfig(),
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
			config: await terminalConfig(),
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
				config: await terminalConfig(),
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
			config: await terminalConfig(),
			projectId: project.id,
			projectName: project.name,
			taskId: task.id,
			taskTitle: task.title ?? "",
		});
		return { ok: true };
	}),

	listInvocationSessions: protectedProcedure
		.input(InvocationSessionsSchema)
		.handler(async ({ input }) =>
			Terminal.listInvocationSessions({ config: await terminalConfig(), projects: input.projects }),
		),

	closeInvocationSessions: protectedProcedure
		.input(InvocationSessionsSchema)
		.handler(async ({ input }) => {
			const closed = await Terminal.closeInvocationSessions({
				config: await terminalConfig(),
				projects: input.projects,
			});
			return { closed };
		}),

	sweepAllActive: protectedProcedure.handler(async () => {
		const projects = await dbProjects.getAll();
		const closed = await Terminal.closeInvocationSessions({
			config: await terminalConfig(),
			projects: projects.map((project) => ({ id: project.id, name: project.name })),
		});
		await killStrayAgentBrowsers();
		return { closed, strayKilled: true };
	}),
};

export const terminalWsRouter = {
	events: protectedProcedure.handler(({ signal }) => PubSub.terminal.subscribe(signal)),
};
