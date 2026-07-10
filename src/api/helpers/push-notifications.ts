import webpush from "web-push";

import { envVariables } from "../config/env";
import { dbPushSubscriptions } from "../db/push-subscriptions";

const vapid =
	envVariables.KOWORK_VAPID_PUBLIC_KEY && envVariables.KOWORK_VAPID_PRIVATE_KEY
		? {
				publicKey: envVariables.KOWORK_VAPID_PUBLIC_KEY,
				privateKey: envVariables.KOWORK_VAPID_PRIVATE_KEY,
				subject: envVariables.KOWORK_VAPID_SUBJECT ?? "https://kw.paganagency.dedyn.io",
			}
		: null;

if (vapid) {
	webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
}

function responseStatus(error: unknown) {
	if (typeof error !== "object" || error === null || !("statusCode" in error)) {
		return null;
	}

	return typeof error.statusCode === "number" ? error.statusCode : null;
}

export const PushNotifications = {
	async status(userId: number) {
		return {
			available: !!vapid,
			subscribed: (await dbPushSubscriptions.listByUser(userId)).length > 0,
			vapidPublicKey: vapid?.publicKey ?? null,
		};
	},

	async send(userId: number, payload: { title: string; body: string; url?: string; tag?: string }) {
		if (!vapid) {
			return 0;
		}

		const subscriptions = await dbPushSubscriptions.listByUser(userId);
		const results = await Promise.all(
			subscriptions.map(async (subscription) => {
				try {
					await webpush.sendNotification(
						{
							endpoint: subscription.endpoint,
							...(subscription.expiration_time
								? { expirationTime: subscription.expiration_time }
								: {}),
							keys: { p256dh: subscription.p256dh, auth: subscription.auth },
						},
						JSON.stringify(payload),
					);
					return true;
				} catch (error) {
					const status = responseStatus(error);
					if (status === 404 || status === 410) {
						await dbPushSubscriptions.removeByEndpoint(subscription.endpoint);
					}
					return false;
				}
			}),
		);

		return results.filter(Boolean).length;
	},
};
