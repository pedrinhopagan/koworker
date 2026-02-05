import type { CategoryDbCreateInput, CategoryDbUpdateInput } from "../schemas/categories";
import { type categories, db } from "./connection";
import { normalizeEntityName } from "./entity-name";
import { cleanUpdate } from "./helpers";

export const dbCategories = {
	getAll: () => db.selectFrom("categories").selectAll().orderBy("display_order", "asc").execute(),

	getById: (id: string) =>
		db.selectFrom("categories").selectAll().where("id", "=", id).executeTakeFirst(),

	create: async (input: CategoryDbCreateInput) => {
		const maxOrder = await db
			.selectFrom("categories")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("categories")
			.values({ ...(input as categories), display_order: displayOrder })
			.executeTakeFirst();
	},

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

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("categories")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.executeTakeFirst();
			}
		});
	},

	findByNormalizedName: async (name: string, excludeId?: string) => {
		const rows = await db.selectFrom("categories").selectAll().execute();
		const normalized = normalizeEntityName(name);

		return (
			rows.find((row) => {
				if (excludeId && row.id === excludeId) return false;
				return normalizeEntityName(row.name) === normalized;
			}) ?? null
		);
	},
};
