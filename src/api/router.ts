import { protectedProcedure, publicProcedure } from "./auth/context";
import { Auth } from "./auth/login";
import { PubSub } from "./pubsub";
import { EndpointSchemas } from "./schemas";

export const router = {
	auth: {
		login: publicProcedure
			.input(EndpointSchemas.authLogin)
			.handler(({ input, context }) => Auth.login(input, context.resHeaders)),

		logout: protectedProcedure.handler(({ context }) => Auth.logout(context.resHeaders)),

		me: protectedProcedure.handler(({ context }) => context.user),
	},

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
};
