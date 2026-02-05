import { protectedProcedure } from "../auth/context";
import type { subtasks } from "../db/connection";
import { dbSubtasks } from "../db/subtasks";
import {
	SubtaskCreateSchema,
	SubtaskIdSchema,
	SubtaskListByTaskSchema,
	SubtaskReorderSchema,
	SubtaskUpdateSchema,
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
	displayOrder: row.display_order,
});

export const subtasksRouter = {
	listByTask: protectedProcedure.input(SubtaskListByTaskSchema).handler(async ({ input }) => {
		const rows = await dbSubtasks.listByTask(input.taskId);
		return rows.map(mapSubtask);
	}),

	getById: protectedProcedure.input(SubtaskIdSchema).handler(async ({ input }) => {
		const row = await dbSubtasks.getById(input.id);
		return row ? mapSubtask(row) : null;
	}),

	create: protectedProcedure.input(SubtaskCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbSubtasks.create({
			id,
			task_id: input.taskId,
			title: input.title,
			description: input.description,
			status: input.status,
			completed_at: input.completedAt,
			display_order: input.displayOrder,
		});

		const row = await dbSubtasks.getById(id);
		return row ? mapSubtask(row) : null;
	}),

	update: protectedProcedure.input(SubtaskUpdateSchema).handler(async ({ input }) => {
		await dbSubtasks.update({
			id: input.id,
			title: input.title,
			description: input.description,
			status: input.status,
			completed_at: input.completedAt,
			display_order: input.displayOrder,
		});

		const row = await dbSubtasks.getById(input.id);
		return row ? mapSubtask(row) : null;
	}),

	remove: protectedProcedure.input(SubtaskIdSchema).handler(async ({ input }) => {
		await dbSubtasks.delete(input.id);
		return { id: input.id };
	}),

	reorder: protectedProcedure.input(SubtaskReorderSchema).handler(async ({ input }) => {
		await dbSubtasks.reorder(input.orderedIds);
		return { success: true };
	}),
};
