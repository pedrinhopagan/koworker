import { protectedProcedure } from "../auth/context";
import type { subtasks, tasks } from "../db/connection";
import { dbSubtasks } from "../db/subtasks";
import { dbTasks } from "../db/tasks";
import { jsonParse, jsonStringify } from "../helpers/json";
import { PubSub } from "../pubsub";
import {
	TaskCreateSchema,
	TaskFocusSchema,
	TaskIdSchema,
	TaskListByDateSchema,
	TaskListByProjectSchema,
	TaskListByWeekSchema,
	TaskMetricsSchema,
	TaskUpdateSchema,
} from "../schemas";

const mapSubtask = (row: subtasks) => ({
	id: row.id,
	taskId: row.task_id,
	title: row.title,
	description: row.description ?? undefined,
	status: row.status,
	completedAt: row.completed_at ?? undefined,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

const mapTask = (row: tasks, input?: { subtasks?: subtasks[] }) => ({
	id: row.id,
	projectId: row.project_id,
	title: row.title,
	description: row.description ?? undefined,
	notes: row.notes ?? undefined,
	aiMetadata: jsonParse<unknown>(row.ai_metadata),
	priorityId: row.priority_id,
	categoryId: row.category_id,
	status: row.status,
	acceptanceCriteria:
		jsonParse<{ id: string; text: string; done: boolean }[]>(row.acceptance_criteria) ?? [],
	scheduledDate: row.scheduled_date ?? undefined,
	completedAt: row.completed_at ?? undefined,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
	deletedAt: row.deleted_at ?? undefined,
	subtasks: input?.subtasks ? input.subtasks.map(mapSubtask) : undefined,
});

export const tasksRouter = {
	metrics: protectedProcedure.input(TaskMetricsSchema).handler(async ({ input }) => {
		const result = await dbTasks.getMetrics(input.projectId);
		return {
			total: result?.total ?? 0,
			pending: result?.pending ?? 0,
			inProgress: result?.in_progress ?? 0,
			done: result?.done ?? 0,
		};
	}),

	focus: protectedProcedure.input(TaskFocusSchema).handler(async ({ input }) => {
		const row = await dbTasks.getFocusTask(input.projectId ?? null);
		if (!row) return null;

		const subtaskRows = await dbSubtasks.listByTask(row.id);
		return mapTask(row, { subtasks: subtaskRows });
	}),

	listByProject: protectedProcedure.input(TaskListByProjectSchema).handler(async ({ input }) => {
		const rows = await dbTasks.listByProject(input.projectId);
		return rows.map((row) => mapTask(row));
	}),

	listByDate: protectedProcedure.input(TaskListByDateSchema).handler(async ({ input }) => {
		const rows = await dbTasks.listByDate(input.date);
		return rows.map((row) => mapTask(row));
	}),

	listByWeek: protectedProcedure.input(TaskListByWeekSchema).handler(async ({ input }) => {
		const rows = await dbTasks.listByDateRange(input.startDate, input.endDate);
		return rows.map((row) => mapTask(row));
	}),

	getById: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) return null;

		const subtaskRows = await dbSubtasks.listByTask(input.id);
		return mapTask(row, { subtasks: subtaskRows });
	}),

	create: protectedProcedure.input(TaskCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbTasks.create({
			id,
			project_id: input.projectId,
			title: input.title,
			description: input.description,
			notes: input.notes,
			ai_metadata: jsonStringify(input.aiMetadata),
			priority_id: input.priorityId,
			category_id: input.categoryId,
			status: input.status,
			acceptance_criteria: jsonStringify(input.acceptanceCriteria),
			scheduled_date: input.scheduledDate,
		});

		await PubSub.publish("tasks", input.projectId, {
			taskId: id,
			projectId: input.projectId,
			action: "created",
		});

		const row = await dbTasks.getById(id);
		return row ? mapTask(row) : null;
	}),

	update: protectedProcedure.input(TaskUpdateSchema).handler(async ({ input }) => {
		await dbTasks.update({
			id: input.id,
			title: input.title,
			description: input.description,
			notes: input.notes,
			ai_metadata: jsonStringify(input.aiMetadata),
			priority_id: input.priorityId,
			category_id: input.categoryId,
			status: input.status,
			acceptance_criteria: jsonStringify(input.acceptanceCriteria),
			scheduled_date: input.scheduledDate,
			completed_at: input.completedAt,
		});

		const row = await dbTasks.getById(input.id);
		if (row) {
			await PubSub.publish("tasks", row.project_id, {
				taskId: row.id,
				projectId: row.project_id,
				action: "updated",
			});
		}
		return row ? mapTask(row) : null;
	}),

	remove: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		await dbTasks.softDelete(input.id);
		if (row) {
			await PubSub.publish("tasks", row.project_id, {
				taskId: row.id,
				projectId: row.project_id,
				action: "deleted",
			});
		}
		return { id: input.id };
	}),
};
