import { db, type settings } from "./connection";

export const dbSettings = {
	getAll: () => db.selectFrom("settings").selectAll().execute(),

	has: async (key: string) => {
		const row = await db
			.selectFrom("settings")
			.select("key")
			.where("key", "=", key)
			.executeTakeFirst();

		return !!row;
	},

	set: ({ key, value }: { key: string; value: string }) =>
		db
			.insertInto("settings")
			.values({ key, value, updated_at: Date.now() } as settings)
			.onConflict((oc) =>
				oc.column("key").doUpdateSet({ value, updated_at: Date.now() } as Partial<settings>),
			)
			.executeTakeFirst(),
};
