import { protectedProcedure, publicProcedure } from "./auth/context";
import { Auth } from "./auth/login";
import { PubSub } from "./pubsub";
import { categoriesRouter } from "./routers/categories";
import { eventsRouter } from "./routers/events";
import { prioritiesRouter } from "./routers/priorities";
import { projectRoutesRouter } from "./routers/project-routes";
import { projectsRouter } from "./routers/projects";
import { skillCategoriesRouter } from "./routers/skill-categories";
import { skillsRouter } from "./routers/skills";
import { taskGroupsRouter } from "./routers/task-groups";
import { tasksRouter } from "./routers/tasks";
import { terminalRouter, terminalWsRouter } from "./routers/terminal";
import { vaultRouter } from "./routers/vault";
import { EndpointSchemas } from "./schemas";

export const router = {
	auth: {
		login: publicProcedure
			.input(EndpointSchemas.authLogin)
			.handler(({ input, context }) => Auth.login(input, context.resHeaders, context.reqHeaders)),

		logout: protectedProcedure.handler(({ context }) => Auth.logout(context.resHeaders)),

		me: protectedProcedure.handler(({ context }) => context.user),
	},
	projects: projectsRouter,
	projectRoutes: projectRoutesRouter,
	tasks: tasksRouter,
	taskGroups: taskGroupsRouter,
	events: eventsRouter,
	categories: categoriesRouter,
	priorities: prioritiesRouter,
	skills: skillsRouter,
	skillCategories: skillCategoriesRouter,
	terminal: terminalRouter,
	vault: vaultRouter,

	testNotification: protectedProcedure.handler(async ({ context }) => {
		await PubSub.publish("notification", String(context.user.id), {
			title: "Test Notification",
			message: `Hello ${context.user.name}! This is a test notification at ${new Date().toLocaleTimeString()}`,
		});

		return { sent: true };
	}),
};

export const wsRouter = {
	auth: {
		me: protectedProcedure.handler(({ context }) => context.user),
	},

	notifications: protectedProcedure.handler(({ context, signal }) =>
		PubSub.subscribe("notification", String(context.user.id), signal),
	),

	tasks: protectedProcedure.handler(({ signal }) => PubSub.subscribe("tasks", "global", signal)),

	events: protectedProcedure.handler(({ signal }) => PubSub.subscribe("events", "global", signal)),

	terminal: terminalWsRouter,
};
