import type { TaskGroupDbCreateInput, TaskGroupDbUpdateInput } from "../schemas/task-groups";
import { db, type task_groups } from "./connection";
import { cleanUpdate } from "./helpers";

export const dbTaskGroups = {
	listByProject: (projectId: string) =>
		db
			.selectFrom("task_groups")
			.selectAll()
			.where("project_id", "=", projectId)
			.orderBy("display_order", "asc")
			.execute(),

	getById: (id: string) =>
		db.selectFrom("task_groups").selectAll().where("id", "=", id).executeTakeFirst(),

	create: async (input: TaskGroupDbCreateInput) => {
		const maxOrder = await db
			.selectFrom("task_groups")
			.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
			.where("project_id", "=", input.project_id)
			.executeTakeFirst();

		const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

		return db
			.insertInto("task_groups")
			.values({ ...(input as task_groups), display_order: displayOrder })
			.executeTakeFirst();
	},

	update: (input: { id: string } & TaskGroupDbUpdateInput) => {
		const { id, ...values } = input;
		const cleanValues = cleanUpdate(values);

		return db
			.updateTable("task_groups")
			.set({ ...cleanValues, updated_at: Date.now() })
			.where("id", "=", id)
			.executeTakeFirst();
	},

	// As tasks do grupo voltam pro "Sem grupo": em bancos novos a FK SET NULL faz isso, mas
	// bancos migrados não têm a FK (ALTER não a anexa), então soltamos as tasks à mão.
	delete: async (id: string) => {
		await db.updateTable("tasks").set({ group_id: null }).where("group_id", "=", id).execute();
		return db.deleteFrom("task_groups").where("id", "=", id).executeTakeFirst();
	},

	reorder: async (orderedIds: string[]) => {
		await db.transaction().execute(async (trx) => {
			for (const [index, id] of orderedIds.entries()) {
				await trx
					.updateTable("task_groups")
					.set({ display_order: index, updated_at: Date.now() })
					.where("id", "=", id)
					.executeTakeFirst();
			}
		});
	},
};
