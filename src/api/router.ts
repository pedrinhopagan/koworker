import { protectedProcedure, publicProcedure } from "./auth/context";
import { Auth } from "./auth/login";
import { PubSub } from "./pubsub";
import { EndpointSchemas, TaskListByProjectSchema } from "./schemas";
import { projectsRouter } from "./routers/projects";
import { tasksRouter } from "./routers/tasks";
import { subtasksRouter } from "./routers/subtasks";
import { categoriesRouter } from "./routers/categories";
import { prioritiesRouter } from "./routers/priorities";

export const router = {
	auth: {
		login: publicProcedure
			.input(EndpointSchemas.authLogin)
			.handler(({ input, context }) => Auth.login(input, context.resHeaders)),

		logout: protectedProcedure.handler(({ context }) => Auth.logout(context.resHeaders)),

		me: protectedProcedure.handler(({ context }) => context.user),
	},
	projects: projectsRouter,
	tasks: tasksRouter,
	subtasks: subtasksRouter,
	categories: categoriesRouter,
	priorities: prioritiesRouter,

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

	tasks: {
		events: protectedProcedure
			.input(TaskListByProjectSchema)
			.handler(({ input, signal }) => PubSub.subscribe("tasks", input.projectId, signal)),
	},
};
