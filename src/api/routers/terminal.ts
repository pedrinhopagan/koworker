import { protectedProcedure } from "../auth/context";
import { getSystemSettings } from "../helpers/system-settings";
import { Terminal } from "../helpers/terminal/service";
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

export const terminalRouter = {
	openForTask: protectedProcedure
		.input(OpenForTaskSchema)
		.handler(async ({ input }) =>
			Terminal.openForTask({ config: await terminalConfig(), ...input }),
		),

	openForRoute: protectedProcedure
		.input(OpenForRouteSchema)
		.handler(async ({ input }) =>
			Terminal.openForRoute({ config: await terminalConfig(), ...input }),
		),

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
};

export const terminalWsRouter = {
	events: protectedProcedure.handler(({ signal }) => PubSub.terminal.subscribe(signal)),
};
