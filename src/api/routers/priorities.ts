import { protectedProcedure } from "../auth/context";
import type { priorities } from "../db/connection";
import { dbPriorities } from "../db/priorities";
import { PriorityCreateSchema, PriorityIdSchema, PriorityUpdateSchema } from "../schemas";

const mapPriority = (row: priorities) => ({
	id: row.id,
	name: row.name,
	color: row.color,
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
			color: input.color,
		});

		const row = await dbPriorities.getById(id);
		return row ? mapPriority(row) : null;
	}),

	update: protectedProcedure.input(PriorityUpdateSchema).handler(async ({ input }) => {
		await dbPriorities.update({
			id: input.id,
			name: input.name,
			color: input.color,
		});

		const row = await dbPriorities.getById(input.id);
		return row ? mapPriority(row) : null;
	}),
};
