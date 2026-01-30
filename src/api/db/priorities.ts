import type { PriorityDbCreateInput, PriorityDbUpdateInput } from "../schemas/priorities";
import { db, type priorities } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbPriorities = {
	getAll: () => db.selectFrom("priorities").selectAll().orderBy("display_order", "asc").execute(),

	getById: (id: string) =>
		db.selectFrom("priorities").selectAll().where("id", "=", id).executeTakeFirst(),

	create: async (input: PriorityDbCreateInput) => {
		// Get max display_order for new items
		const maxOrder = await db
			.selectFrom("priorities")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("priorities")
			.values({
				...input,
				display_order: displayOrder,
			} as priorities)
			.executeTakeFirst();
	},

	update: (input: { id: string } & PriorityDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("priorities")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	delete: (id: string) => db.deleteFrom("priorities").where("id", "=", id).executeTakeFirst(),

	reorder: async (orderedIds: string[]) => {
		// Update display_order for each priority based on array position
		const updates = orderedIds.map((id, index) =>
			db
				.updateTable("priorities")
				.set({ display_order: index, updated_at: Date.now() })
				.where("id", "=", id)
				.executeTakeFirst(),
		);

		await Promise.all(updates);
	},

	hasAssociatedTasks: async (id: string) => {
		const result = await db
			.selectFrom("tasks")
			.select(({ fn }) => [fn.count("id").as("count")])
			.where("priority_id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst();

		return (result?.count as number) > 0;
	},

	migrateTasksAndDelete: async (sourceId: string, targetId: string) => {
		// First migrate all tasks from source to target priority
		await db
			.updateTable("tasks")
			.set({ priority_id: targetId, updated_at: Date.now() })
			.where("priority_id", "=", sourceId)
			.execute();

		// Then delete the source priority
		await db.deleteFrom("priorities").where("id", "=", sourceId).executeTakeFirst();
	},
};
