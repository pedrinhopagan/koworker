import { db, type devices } from "./connection";

export type DeviceStatus = devices["status"];

export const DbDevices = {
	getById(id: string) {
		return db.selectFrom("devices").where("id", "=", id).selectAll().executeTakeFirst();
	},

	listByUser(userId: number) {
		return db
			.selectFrom("devices")
			.where("user_id", "=", userId)
			.orderBy("last_seen_at", "desc")
			.selectAll()
			.execute();
	},

	countPending(userId: number) {
		return db
			.selectFrom("devices")
			.where("user_id", "=", userId)
			.where("status", "=", "pending")
			.select(db.fn.countAll<number>().as("total"))
			.executeTakeFirst();
	},

	async create(input: {
		userId: number;
		name: string;
		status: DeviceStatus;
		userAgent: string | undefined;
		ip: string | undefined;
	}) {
		const now = Date.now();
		const id = crypto.randomUUID();

		await db
			.insertInto("devices")
			.values({
				id,
				user_id: input.userId,
				name: input.name,
				status: input.status,
				...(input.userAgent ? { user_agent: input.userAgent } : {}),
				...(input.ip ? { first_ip: input.ip, last_ip: input.ip } : {}),
				created_at: now,
				last_seen_at: now,
				...(input.status === "approved" ? { approved_at: now } : {}),
			} as devices)
			.execute();

		return db.selectFrom("devices").where("id", "=", id).selectAll().executeTakeFirstOrThrow();
	},

	touch(id: string, input: { userAgent: string | undefined; ip: string | undefined }) {
		return db
			.updateTable("devices")
			.set({
				last_seen_at: Date.now(),
				...(input.userAgent ? { user_agent: input.userAgent } : {}),
				...(input.ip ? { last_ip: input.ip } : {}),
			})
			.where("id", "=", id)
			.execute();
	},

	setStatus(id: string, status: DeviceStatus) {
		const now = Date.now();

		return db
			.updateTable("devices")
			.set({
				status,
				...(status === "approved" ? { approved_at: now, blocked_at: null } : {}),
				...(status === "blocked" ? { blocked_at: now } : {}),
			})
			.where("id", "=", id)
			.execute();
	},

	rename(id: string, name: string) {
		return db.updateTable("devices").set({ name }).where("id", "=", id).execute();
	},

	remove(id: string) {
		return db.deleteFrom("devices").where("id", "=", id).execute();
	},
};
