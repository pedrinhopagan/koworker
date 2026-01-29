import { db } from "./connection";
import { cleanUpdate } from "./helpers";
import type { CategoryDbCreateInput, CategoryDbUpdateInput } from "../schemas/categories";

export const dbCategories = {
	getAll: () => db.selectFrom("categories").selectAll().execute(),

	getById: (id: string) =>
		db.selectFrom("categories").selectAll().where("id", "=", id).executeTakeFirst(),

	create: (input: CategoryDbCreateInput) =>
		db.insertInto("categories").values(input).executeTakeFirst(),

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
