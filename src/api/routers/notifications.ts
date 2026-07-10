import { protectedProcedure } from "../auth/context";
import { dbPushSubscriptions } from "../db/push-subscriptions";
import { PushNotifications } from "../helpers/push-notifications";
import { PushSubscriptionSchema, PushUnsubscribeSchema } from "../schemas/notifications";

export const notificationsRouter = {
	status: protectedProcedure.handler(({ context }) => PushNotifications.status(context.user.id)),

	subscribe: protectedProcedure
		.input(PushSubscriptionSchema)
		.handler(async ({ input, context }) => {
			await dbPushSubscriptions.upsert(context.user.id, input);
			return { subscribed: true };
		}),

	unsubscribe: protectedProcedure
		.input(PushUnsubscribeSchema)
		.handler(async ({ input, context }) => {
			await dbPushSubscriptions.remove(context.user.id, input.endpoint);
			return { subscribed: false };
		}),

	test: protectedProcedure.handler(async ({ context }) => ({
		sent: await PushNotifications.send(context.user.id, {
			title: "Alertas do Kowork ativos",
			body: "Você receberá avisos quando uma execução terminar ou precisar de atenção.",
			url: "/configuracoes",
			tag: "kowork-push-test",
		}),
	})),
};
