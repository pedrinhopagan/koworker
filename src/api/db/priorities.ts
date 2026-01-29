import type { PriorityDbCreateInput, PriorityDbUpdateInput } from "../schemas/priorities";
import { db, type priorities } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbPriorities = {
	getAll: () => db.selectFrom("priorities").selectAll().execute(),

	getById: (id: string) =>
		db.selectFrom("priorities").selectAll().where("id", "=", id).executeTakeFirst(),

	create: (input: PriorityDbCreateInput) =>
		db
			.insertInto("priorities")
			.values(input as priorities)
			.executeTakeFirst(),

	update: (input: { id: string } & PriorityDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("priorities")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},
};
