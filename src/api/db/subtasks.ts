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
			.orderBy("created_at", "asc")
			.orderBy("id", "asc")
			.execute();
	},

	create: (input: SubtaskDbCreateInput) =>
		db
			.insertInto("subtasks")
			.values(input as subtasks)
			.executeTakeFirst(),

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
};
