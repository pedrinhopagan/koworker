import type { Insertable, Updateable } from "kysely";
import { db } from "./connection";
import type { categories } from "./connection";
import { cleanUpdate } from "./helpers";

type CategoriesCreateInput = Insertable<categories>;
type CategoriesUpdateInput = Updateable<categories>;

export const dbCategories = {
	getAll: () => db.selectFrom("categories").selectAll().execute(),

	getById: (id: string) =>
		db.selectFrom("categories").selectAll().where("id", "=", id).executeTakeFirst(),

	create: (input: CategoriesCreateInput) =>
		db.insertInto("categories").values(input).executeTakeFirst(),

	update: (input: { id: string } & CategoriesUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("categories")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},
};
