import { db } from "./connection";

export const DbUsers = {
	getById(id: number) {
		return db.selectFrom("users").where("id", "=", id).selectAll().executeTakeFirst();
	},

	getByName(name: string) {
		return db.selectFrom("users").where("name", "=", name).selectAll().executeTakeFirst();
	},
};
