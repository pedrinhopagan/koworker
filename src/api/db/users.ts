import { db } from "./connection";

export const DbUsers = {
	getById(id: number) {
		return db.selectFrom("users").where("id", "=", id).selectAll().executeTakeFirst();
	},

	getByName(name: string) {
		return db.selectFrom("users").where("name", "=", name).selectAll().executeTakeFirst();
	},

	async ensureDefaultUser() {
		const result = await db
			.selectFrom("users")
			.select(db.fn.countAll<number>().as("total"))
			.executeTakeFirst();
		const total = Number(result?.total ?? 0);
		if (total > 0) {
			return;
		}
		await db
			.insertInto("users")
			.values({
				name: "admin",
				password: Bun.password.hashSync("password"),
				user_type: "admin",
			})
			.execute();
	},
};
