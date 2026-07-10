import { ORPCError } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "./auth/context";
import { Auth } from "./auth/login";
import { getPromptRun } from "./helpers/prompt-run";
import { PubSub } from "./pubsub";
import { agentsRouter } from "./routers/agents";
import { categoriesRouter } from "./routers/categories";
import { flowRouter } from "./routers/flow";
import { kwTerminalRouter } from "./routers/kw-terminal";
import { mediaRouter } from "./routers/media";
import { mostruarioRouter } from "./routers/mostruario";
import { notificationsRouter } from "./routers/notifications";
import { prioritiesRouter } from "./routers/priorities";
import { promptRouter } from "./routers/prompt";
import { promptHistoryRouter } from "./routers/prompt-history";
import { projectRoutesRouter } from "./routers/project-routes";
import { projectsRouter } from "./routers/projects";
import { settingsRouter } from "./routers/settings";
import { skillCategoriesRouter } from "./routers/skill-categories";
import { skillsRouter } from "./routers/skills";
import { systemRouter } from "./routers/system";
import { taskGroupsRouter } from "./routers/task-groups";
import { tasksRouter } from "./routers/tasks";
import { terminalRouter, terminalWsRouter } from "./routers/terminal";
import { vaultRouter } from "./routers/vault";
import { EndpointSchemas, FlowTaskSchema, PromptRunIdSchema } from "./schemas";

export const router = {
	auth: {
		login: publicProcedure
			.input(EndpointSchemas.authLogin)
			.handler(({ input, context }) => Auth.login(input, context.resHeaders, context.reqHeaders)),

		logout: protectedProcedure.handler(({ context }) => Auth.logout(context.resHeaders)),

		me: protectedProcedure.handler(({ context }) => ({
			id: context.user.id,
			name: context.user.name,
		})),
	},
	projects: projectsRouter,
	projectRoutes: projectRoutesRouter,
	tasks: tasksRouter,
	taskGroups: taskGroupsRouter,
	categories: categoriesRouter,
	priorities: prioritiesRouter,
	flow: flowRouter,
	skills: skillsRouter,
	skillCategories: skillCategoriesRouter,
	agents: agentsRouter,
	prompt: promptRouter,
	promptHistory: promptHistoryRouter,
	terminal: terminalRouter,
	kwTerminal: kwTerminalRouter,
	vault: vaultRouter,
	media: mediaRouter,
	mostruario: mostruarioRouter,
	notifications: notificationsRouter,
	settings: settingsRouter,
	system: systemRouter,

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
		me: protectedProcedure.handler(({ context }) => ({
			id: context.user.id,
			name: context.user.name,
		})),
	},

	notifications: protectedProcedure.handler(({ context, signal }) =>
		PubSub.subscribe("notification", String(context.user.id), signal),
	),

	tasks: protectedProcedure.handler(({ signal }) => PubSub.subscribe("tasks", "global", signal)),

	flow: protectedProcedure
		.input(FlowTaskSchema)
		.handler(({ input, signal }) => PubSub.subscribe("flow", input.taskId, signal)),

	promptRun: protectedProcedure.input(PromptRunIdSchema).handler(async function* ({
		input,
		context,
		signal,
	}) {
		// Assina antes de ler o registro: um run curto pode terminar entre a leitura e a assinatura,
		// e o evento terminal se perderia — o cliente ficaria em "executando" pra sempre. Com a ordem
		// invertida, ou o snapshot já é terminal, ou o evento chega pela assinatura.
		const events = PubSub.subscribe("promptRun", input.runId, signal);

		const record = await getPromptRun(input.runId, context.user.id);
		if (!record) {
			throw new ORPCError("NOT_FOUND", { message: "Execução não encontrada" });
		}

		if (record.status !== "running") {
			yield {
				runId: record.runId,
				status: record.status,
				...(record.output ? { output: record.output } : {}),
				...(record.error ? { error: record.error } : {}),
			};
			return;
		}

		yield* events;
	}),

	terminal: terminalWsRouter,
};
