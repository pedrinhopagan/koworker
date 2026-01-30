import { sql } from "kysely";

import type { TaskDbCreateInput, TaskDbUpdateInput } from "../schemas/tasks";
import { db, type tasks } from "./connection";
import { cleanUpdate } from "./helpers";

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

	listByDate: (date: string) =>
		db
			.selectFrom("tasks")
			.selectAll()
			.where("scheduled_date", "=", date)
			.where("deleted_at", "is", null)
			.execute(),

	listByDateRange: (startDate: string, endDate: string) =>
		db
			.selectFrom("tasks")
			.selectAll()
			.where("scheduled_date", ">=", startDate)
			.where("scheduled_date", "<=", endDate)
			.where("deleted_at", "is", null)
			.execute(),

	create: (input: TaskDbCreateInput) =>
		db
			.insertInto("tasks")
			.values(input as tasks)
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

	getStatsByProject: () =>
		db
			.selectFrom("tasks")
			.select([
				"project_id",
				sql<number>`count(*)`.as("total"),
				sql<number>`sum(case when status = 'pending' then 1 else 0 end)`.as("pending"),
				sql<number>`sum(case when status = 'in_progress' then 1 else 0 end)`.as("in_progress"),
				sql<number>`sum(case when status = 'done' then 1 else 0 end)`.as("done"),
				sql<number | null>`max(updated_at)`.as("last_updated"),
			])
			.where("deleted_at", "is", null)
			.groupBy("project_id")
			.execute(),

	getMetrics: (projectId: string | null) => {
		let query = db
			.selectFrom("tasks")
			.select([
				sql<number>`count(*)`.as("total"),
				sql<number>`sum(case when status = 'pending' then 1 else 0 end)`.as("pending"),
				sql<number>`sum(case when status = 'in_execution' then 1 else 0 end)`.as("in_progress"),
				sql<number>`sum(case when status = 'executed' then 1 else 0 end)`.as("done"),
			])
			.where("deleted_at", "is", null);

		if (projectId) {
			query = query.where("project_id", "=", projectId);
		}

		return query.executeTakeFirst();
	},

	getFocusTask: (projectId: string | null) => {
		let query = db
			.selectFrom("tasks")
			.innerJoin("priorities", "priorities.id", "tasks.priority_id")
			.selectAll("tasks")
			.where("tasks.deleted_at", "is", null)
			.where("tasks.status", "in", ["pending", "in_execution"])
			.orderBy("priorities.level", "asc")
			.orderBy("tasks.created_at", "asc")
			.limit(1);

		if (projectId) {
			query = query.where("tasks.project_id", "=", projectId);
		}

		return query.executeTakeFirst();
	},
};
