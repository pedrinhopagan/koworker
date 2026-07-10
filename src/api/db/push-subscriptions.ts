import type { PushSubscriptionInput } from "../schemas/notifications";
import { db, type push_subscriptions } from "./connection";

export const dbPushSubscriptions = {
	listByUser(userId: number) {
		return db
			.selectFrom("push_subscriptions as ps")
			.selectAll("ps")
			.where("ps.user_id", "=", userId)
			.execute();
	},

	async upsert(userId: number, input: PushSubscriptionInput) {
		const now = Date.now();

		await db
			.insertInto("push_subscriptions")
			.values({
				id: crypto.randomUUID(),
				user_id: userId,
				endpoint: input.endpoint,
				p256dh: input.keys.p256dh,
				auth: input.keys.auth,
				...(input.expirationTime ? { expiration_time: input.expirationTime } : {}),
				created_at: now,
				updated_at: now,
			} as push_subscriptions)
			.onConflict((conflict) =>
				conflict.column("endpoint").doUpdateSet({
					user_id: userId,
					p256dh: input.keys.p256dh,
					auth: input.keys.auth,
					...(input.expirationTime ? { expiration_time: input.expirationTime } : {}),
					updated_at: now,
				}),
			)
			.execute();

		return db
			.selectFrom("push_subscriptions as ps")
			.selectAll("ps")
			.where("ps.endpoint", "=", input.endpoint)
			.where("ps.user_id", "=", userId)
			.executeTakeFirstOrThrow();
	},

	remove(userId: number, endpoint: string) {
		return db
			.deleteFrom("push_subscriptions")
			.where("user_id", "=", userId)
			.where("endpoint", "=", endpoint)
			.execute();
	},

	removeByEndpoint(endpoint: string) {
		return db.deleteFrom("push_subscriptions").where("endpoint", "=", endpoint).execute();
	},
};
