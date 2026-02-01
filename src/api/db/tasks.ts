import { sql } from "kysely";

import {
	type TaskDbCreateInput,
	TaskDbCreateSchema,
	type TaskDbUpdateInput,
	TaskDbUpdateSchema,
	type TaskListFiltersInput,
} from "../schemas/tasks";
import { db, type tasks } from "./connection";
import { cleanUpdate } from "./helpers";

const applyTaskListFilters = (
	// biome-ignore lint/suspicious/noExplicitAny: Kysely's builder type is too generic here and propagates poorly; keep helper flexible.
	query: any,
	filters?: (TaskListFiltersInput & { projectId?: string | null }) | null,
) => {
	if (!filters) return query;

	if (filters.projectId) {
		query = query.where("project_id", "=", filters.projectId);
	}

	if (filters.taskTypeId) {
		query = query.where("category_id", "=", filters.taskTypeId);
	}

	const priorityId = filters.priorityId ?? filters.priority;
	if (priorityId) {
		query = query.where("priority_id", "=", priorityId);
	}

	if (filters.status) {
		query = query.where("status", "=", filters.status);
	}

	if (filters.q) {
		const searchTerm = `%${filters.q.trim()}%`;
		query = query.where((eb: any) =>
			eb.or([
				eb("title", "like", searchTerm),
				eb("description", "like", searchTerm),
				eb("notes", "like", searchTerm),
			]),
		);
	}

	return query;
};

export const dbTasks = {
	getById: (id: string) =>
		db
			.selectFrom("tasks")
			.selectAll()
			.where("id", "=", id)
			.where("deleted_at", "is", null)
			.executeTakeFirst(),

	listByProject: (input: { projectId: string } & TaskListFiltersInput) => {
		let query = db.selectFrom("tasks").selectAll().where("deleted_at", "is", null);

		query = applyTaskListFilters(query, input);
		return query.execute();
	},

	listByDate: (
		date: string,
		filters?: (TaskListFiltersInput & { projectId?: string | null }) | null,
	) => {
		let query = db
			.selectFrom("tasks")
			.selectAll()
			.where("scheduled_date", "=", date)
			.where("deleted_at", "is", null);

		query = applyTaskListFilters(query, filters);
		return query.execute();
	},

	listByDateRange: (
		startDate: string,
		endDate: string,
		filters?: (TaskListFiltersInput & { projectId?: string | null }) | null,
	) => {
		let query = db
			.selectFrom("tasks")
			.selectAll()
			.where("scheduled_date", ">=", startDate)
			.where("scheduled_date", "<=", endDate)
			.where("deleted_at", "is", null);

		query = applyTaskListFilters(query, filters);
		return query.execute();
	},

	getAll: (
		input: {
			projectId?: string | null;
			date?: string;
			startDate?: string;
			endDate?: string;
			includeCompleted?: boolean;
		} & TaskListFiltersInput,
	) => {
		let query = db.selectFrom("tasks").selectAll().where("deleted_at", "is", null);

		// Date filters
		if (input.date) {
			query = query.where("scheduled_date", "=", input.date);
		} else if (input.startDate && input.endDate) {
			query = query.where("scheduled_date", ">=", input.startDate);
			query = query.where("scheduled_date", "<=", input.endDate);
		}

		// Exclude completed (approved) tasks by default.
		if (!input.includeCompleted) {
			query = query.where("completed_at", "is", null);
		}

		query = applyTaskListFilters(query, input);
		query = query.orderBy("created_at", "desc");
		return query.execute();
	},

	create: (input: TaskDbCreateInput) => {
		const parsed = TaskDbCreateSchema.parse(input);
		return db
			.insertInto("tasks")
			.values(parsed as tasks)
			.onConflict((oc) => oc.column("id").doNothing())
			.executeTakeFirst();
	},

	update: (input: { id: string } & TaskDbUpdateInput) => {
		const { id, ...values } = input;
		const parsedValues = TaskDbUpdateSchema.parse(values);
		const cleanValues = cleanUpdate(parsedValues);

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
				sql<number>`sum(case when completed_at is null and status = 'pending' then 1 else 0 end)`.as(
					"pending",
				),
				sql<number>`sum(case when completed_at is null and status in ('in_execution', 'in_progress') then 1 else 0 end)`.as(
					"in_progress",
				),
				sql<number>`sum(case when completed_at is not null then 1 else 0 end)`.as("done"),
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
				sql<number>`sum(case when completed_at is null and status = 'pending' then 1 else 0 end)`.as(
					"pending",
				),
				sql<number>`sum(case when completed_at is null and status in ('in_execution', 'in_progress') then 1 else 0 end)`.as(
					"in_progress",
				),
				sql<number>`sum(case when completed_at is not null then 1 else 0 end)`.as("done"),
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
			.where("tasks.completed_at", "is", null)
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
