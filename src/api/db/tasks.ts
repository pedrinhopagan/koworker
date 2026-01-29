import { db } from "./connection";
import { cleanUpdate } from "./helpers";
import type { TaskDbCreateInput, TaskDbUpdateInput } from "../schemas/tasks";

export const dbTasks = {
	getById: (id: string) =>
		db
			.selectFrom("tasks")
			.selectAll()
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

	listByProject: (projectId: string) =>
		db
			.selectFrom("tasks")
			.selectAll()
			.where("project_id", "=", projectId)
			.where("deleted_at", "is", null)
			.execute(),

	create: (input: TaskDbCreateInput) =>
		db
			.insertInto("tasks")
			.values(input)
			.onConflict((oc) => oc.column("id").doNothing())
			.executeTakeFirst(),

	update: (input: { id: string } & TaskDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("tasks")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst();
	},

	softDelete: (id: string) =>
		db
			.updateTable("tasks")
			.set({
				deleted_at: Date.now(),
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),
};
