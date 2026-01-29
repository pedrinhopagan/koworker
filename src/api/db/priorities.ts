import type { Insertable, Updateable } from "kysely";
import { db } from "./connection";
import type { priorities } from "./connection";
import { cleanUpdate } from "./helpers";

type PrioritiesCreateInput = Insertable<priorities>;
type PrioritiesUpdateInput = Updateable<priorities>;

export const dbPriorities = {
	getAll: () => db.selectFrom("priorities").selectAll().execute(),

	getById: (id: string) =>
		db.selectFrom("priorities").selectAll().where("id", "=", id).executeTakeFirst(),

	create: (input: PrioritiesCreateInput) =>
		db.insertInto("priorities").values(input).executeTakeFirst(),

	update: (input: { id: string } & PrioritiesUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("priorities")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},
};
