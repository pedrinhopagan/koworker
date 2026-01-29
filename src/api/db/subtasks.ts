import type { Insertable, Updateable } from "kysely";
import { db } from "./connection";
import type { subtasks } from "./connection";
import { cleanUpdate } from "./helpers";

type SubtasksCreateInput = Insertable<subtasks>;
type SubtasksUpdateInput = Updateable<subtasks>;

export const dbSubtasks = {
	getById: (id: string) =>
		db.selectFrom("subtasks").selectAll().where("id", "=", id).executeTakeFirst(),

	listByTask: (taskId: string) =>
		db.selectFrom("subtasks").selectAll().where("task_id", "=", taskId).execute(),

	create: (input: SubtasksCreateInput) => db.insertInto("subtasks").values(input).executeTakeFirst(),

	update: (input: { id: string } & SubtasksUpdateInput) => {
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
