import { protectedProcedure } from "../auth/context";
import type { priorities } from "../db/connection";
import { dbPriorities } from "../db/priorities";
import {
	PriorityCreateSchema,
	PriorityIdSchema,
	PriorityMigrateAndDeleteSchema,
	PriorityReorderSchema,
	PriorityUpdateSchema,
} from "../schemas";

const mapPriority = (row: priorities) => ({
	id: row.id,
	name: row.name,
	level: row.level,
	color: row.color,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

export const prioritiesRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbPriorities.getAll();
		return rows.map(mapPriority);
	}),

	getById: protectedProcedure.input(PriorityIdSchema).handler(async ({ input }) => {
		const row = await dbPriorities.getById(input.id);
		return row ? mapPriority(row) : null;
	}),

	create: protectedProcedure.input(PriorityCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbPriorities.create({
			id,
			name: input.name,
			level: input.level ?? 1,
			color: input.color,
		});

		const row = await dbPriorities.getById(id);
		return row ? mapPriority(row) : null;
	}),

	update: protectedProcedure.input(PriorityUpdateSchema).handler(async ({ input }) => {
		await dbPriorities.update({
			id: input.id,
			name: input.name,
			level: input.level,
			color: input.color,
		});

		const row = await dbPriorities.getById(input.id);
		return row ? mapPriority(row) : null;
	}),

	delete: protectedProcedure.input(PriorityIdSchema).handler(async ({ input }) => {
		await dbPriorities.delete(input.id);
		return { success: true };
	}),

	reorder: protectedProcedure.input(PriorityReorderSchema).handler(async ({ input }) => {
		await dbPriorities.reorder(input.orderedIds);
		return { success: true };
	}),

	hasAssociatedTasks: protectedProcedure.input(PriorityIdSchema).handler(({ input }) => {
		return dbPriorities.hasAssociatedTasks(input.id);
	}),

	migrateAndDelete: protectedProcedure
		.input(PriorityMigrateAndDeleteSchema)
		.handler(async ({ input }) => {
			await dbPriorities.migrateTasksAndDelete(input.sourceId, input.targetId);
			return { success: true };
		}),
};
