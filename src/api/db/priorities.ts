import { db } from "./connection";
import { cleanUpdate } from "./helpers";
import type { PriorityDbCreateInput, PriorityDbUpdateInput } from "../schemas/priorities";

export const dbPriorities = {
	getAll: () => db.selectFrom("priorities").selectAll().execute(),

	getById: (id: string) =>
		db.selectFrom("priorities").selectAll().where("id", "=", id).executeTakeFirst(),

	create: (input: PriorityDbCreateInput) =>
		db.insertInto("priorities").values(input).executeTakeFirst(),

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
