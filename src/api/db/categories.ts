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

	delete: (id: string) => db.deleteFrom("categories").where("id", "=", id).executeTakeFirst(),

	hasAssociatedTasks: async (categoryId: string): Promise<boolean> => {
		const result = await db
			.selectFrom("tasks")
			.select(db.fn.count("id").as("count"))
			.where("category_id", "=", categoryId)
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		return Number(result?.count ?? 0) > 0;
	},

	migrateTasksToCategory: (sourceId: string, targetId: string) =>
		db
			.updateTable("tasks")
			.set({ category_id: targetId, updated_at: Date.now() })
			.where("category_id", "=", sourceId)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),
};
