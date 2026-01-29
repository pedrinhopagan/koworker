import type { Insertable, Updateable } from "kysely";
import { db } from "./connection";
import type { tasks } from "./connection";
import { cleanUpdate } from "./helpers";

type TasksCreateInput = Insertable<tasks>;
type TasksUpdateInput = Updateable<tasks>;

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

    create: (input: TasksCreateInput) =>
        db
            .insertInto("tasks")
            .values(input)
            .onConflict((oc) => oc.column("id").doNothing())
            .executeTakeFirst(),

	update: (input: { id: string } & TasksUpdateInput) => {
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
