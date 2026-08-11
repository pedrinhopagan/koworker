import { protectedProcedure } from "../auth/context";
import {
	cliSessionCwd,
	getCliSession,
	listCliSessions,
	resumeCliSession,
} from "../helpers/agent-history";
import { openKwDiff } from "../helpers/kw-diff";
import { AgentHistoryListSchema, AgentHistorySessionSchema } from "../schemas/agent-history";

// O histórico não é um espelho do daemon: ele lê o que claude e codex já gravaram em disco. Por isso
// nada aqui depende de pane aberto, e a única ação que toca o terminal é retomar.
export const agentHistoryRouter = {
	list: protectedProcedure
		.input(AgentHistoryListSchema)
		.handler(({ input }) => listCliSessions(input)),

	get: protectedProcedure
		.input(AgentHistorySessionSchema)
		.handler(({ input }) => getCliSession(input)),

	resume: protectedProcedure
		.input(AgentHistorySessionSchema)
		.handler(({ input }) => resumeCliSession(input)),

	openDiff: protectedProcedure.input(AgentHistorySessionSchema).handler(async ({ input }) => {
		const cwd = await cliSessionCwd(input);
		await openKwDiff(cwd);

		return { cwd };
	}),
};
