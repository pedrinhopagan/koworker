import { protectedProcedure } from "../auth/context";
import type { task_groups } from "../db/connection";
import { dbTaskGroups } from "../db/task-groups";
import {
	TaskGroupCreateSchema,
	TaskGroupIdSchema,
	TaskGroupListSchema,
	TaskGroupReorderSchema,
	TaskGroupUpdateSchema,
} from "../schemas";

const mapTaskGroup = (row: task_groups) => ({
	id: row.id,
	projectId: row.project_id,
	name: row.name,
	color: row.color,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

export const taskGroupsRouter = {
	list: protectedProcedure.input(TaskGroupListSchema).handler(async ({ input }) => {
		const rows = await dbTaskGroups.listByProject(input.projectId);
		return rows.map(mapTaskGroup);
	}),

	create: protectedProcedure.input(TaskGroupCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbTaskGroups.create({
			id,
			project_id: input.projectId,
			name: input.name,
			color: input.color,
		});

		const row = await dbTaskGroups.getById(id);
		return row ? mapTaskGroup(row) : null;
	}),

	update: protectedProcedure.input(TaskGroupUpdateSchema).handler(async ({ input }) => {
		await dbTaskGroups.update({ id: input.id, name: input.name, color: input.color });

		const row = await dbTaskGroups.getById(input.id);
		return row ? mapTaskGroup(row) : null;
	}),

	delete: protectedProcedure.input(TaskGroupIdSchema).handler(async ({ input }) => {
		await dbTaskGroups.delete(input.id);
		return { success: true };
	}),

	reorder: protectedProcedure.input(TaskGroupReorderSchema).handler(async ({ input }) => {
		await dbTaskGroups.reorder(input.orderedIds);
		return { success: true };
	}),
};
