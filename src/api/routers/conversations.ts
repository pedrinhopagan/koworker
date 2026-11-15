import { protectedProcedure } from "@/api/auth/context";
import { DbConversations } from "@/api/db/conversations";
import { conversationsRuntime } from "@/api/helpers/conversations";
import { ConversationSchemas } from "@/api/schemas/conversations";

export const conversationsRouter = {
	pane: protectedProcedure
		.input(ConversationSchemas.pane)
		.handler(({ input }) => conversationsRuntime.readPane(input.paneId)),
	list: protectedProcedure.handler(({ context }) => DbConversations.list(context.user.id)),
	cliHistory: protectedProcedure
		.input(ConversationSchemas.cliHistory)
		.handler(({ input }) => conversationsRuntime.cliHistory(input)),
	importCli: protectedProcedure
		.input(ConversationSchemas.importCli)
		.handler(({ input, context }) => conversationsRuntime.importCli(context.user.id, input)),
	models: protectedProcedure
		.input(ConversationSchemas.profile)
		.handler(({ input }) => conversationsRuntime.models(input.profileId)),
	create: protectedProcedure
		.input(ConversationSchemas.create)
		.handler(({ input, context }) => conversationsRuntime.create(context.user.id, input)),
	get: protectedProcedure
		.input(ConversationSchemas.id)
		.handler(({ input, context }) => conversationsRuntime.get(input.id, context.user.id)),
	update: protectedProcedure
		.input(ConversationSchemas.update)
		.handler(({ input, context }) =>
			conversationsRuntime.rename(input.id, context.user.id, input.title),
		),
	send: protectedProcedure
		.input(ConversationSchemas.send)
		.handler(({ input, context }) => conversationsRuntime.send(context.user.id, input)),
	reconcile: protectedProcedure
		.input(ConversationSchemas.id)
		.handler(({ input, context }) => conversationsRuntime.reconcile(input.id, context.user.id)),
	interrupt: protectedProcedure
		.input(ConversationSchemas.id)
		.handler(({ input, context }) => conversationsRuntime.interrupt(input.id, context.user.id)),
	respond: protectedProcedure
		.input(ConversationSchemas.respond)
		.handler(({ input, context }) => conversationsRuntime.respond(context.user.id, input)),
};
