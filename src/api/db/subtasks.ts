import type { SubtaskDbCreateInput, SubtaskDbUpdateInput } from "../schemas/subtasks";
import { db, type subtasks } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbSubtasks = {
	getById: (id: string) =>
		db.selectFrom("subtasks").selectAll().where("id", "=", id).executeTakeFirst(),

	listByTask: (taskId: string) =>
		db
			.selectFrom("subtasks")
			.selectAll()
			.where("task_id", "=", taskId)
			.orderBy("display_order", "asc")
			.orderBy("created_at", "asc")
			.orderBy("id", "asc")
			.execute(),

	listByTaskIds: (taskIds: string[]) => {
		if (!taskIds.length) return Promise.resolve([] as subtasks[]);
		return db
			.selectFrom("subtasks")
			.selectAll()
			.where("task_id", "in", taskIds)
			.orderBy("task_id", "asc")
			.orderBy("display_order", "asc")
			.orderBy("created_at", "asc")
			.orderBy("id", "asc")
			.execute();
	},

	create: async (input: SubtaskDbCreateInput) => {
		let displayOrder = input.display_order;
		if (typeof displayOrder !== "number") {
			const maxOrder = (await db
				.selectFrom("subtasks")
				.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
				.where("task_id", "=", input.task_id)
				.executeTakeFirst()) as { maxOrder?: number | null } | undefined;
			displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;
		}

		return db
			.insertInto("subtasks")
			.values({ ...(input as subtasks), display_order: displayOrder })
			.executeTakeFirst();
	},

	update: (input: { id: string } & SubtaskDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("subtasks")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	delete: (id: string) => db.deleteFrom("subtasks").where("id", "=", id).executeTakeFirst(),

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("subtasks")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.executeTakeFirst();
			}
		});
	},
};
