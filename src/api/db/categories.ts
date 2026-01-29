import type { CategoryDbCreateInput, CategoryDbUpdateInput } from "../schemas/categories";
import { type categories, db } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbCategories = {
	getAll: () => db.selectFrom("categories").selectAll().execute(),

	getById: (id: string) =>
		db.selectFrom("categories").selectAll().where("id", "=", id).executeTakeFirst(),

	create: (input: CategoryDbCreateInput) =>
		db
			.insertInto("categories")
			.values(input as categories)
			.executeTakeFirst(),

	update: (input: { id: string } & CategoryDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("categories")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},
};
