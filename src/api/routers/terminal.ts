import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../auth/context";
import { dbProjectRoutes } from "../db/project-routes";
import { dbProjects } from "../db/projects";
import { getSystemSettings } from "../helpers/system-settings";
import { Terminal } from "../helpers/terminal/service";
import { killStrayAgentBrowsers } from "../helpers/terminal/stray";
import { PubSub } from "../pubsub";
import {
	CloseProjectSessionSchema,
	CloseTaskWindowSchema,
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
			await Terminal.closeProjectSession({ config: await terminalConfig(), ...input });
			return { ok: true };
		}),

	closeTaskWindow: protectedProcedure.input(CloseTaskWindowSchema).handler(async ({ input }) => {
		await Terminal.closeTaskWindow({ config: await terminalConfig(), ...input });
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
