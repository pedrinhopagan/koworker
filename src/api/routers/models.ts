import { protectedProcedure } from "../auth/context";
import type { models } from "../db/connection";
import { dbModels } from "../db/models";
import {
	ModelCreateSchema,
	ModelIdSchema,
	ModelReorderSchema,
	ModelUpdateSchema,
} from "../schemas/models";

const mapModel = (row: models) => ({
	id: row.id,
	name: row.name,
	provider: row.provider ?? undefined,
	modelId: row.model_id ?? undefined,
	color: row.color,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

export const modelsRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbModels.getAll();
		return rows.map(mapModel);
	}),

	getById: protectedProcedure.input(ModelIdSchema).handler(async ({ input }) => {
		const row = await dbModels.getById(input.id);
		return row ? mapModel(row) : null;
	}),

	create: protectedProcedure.input(ModelCreateSchema).handler(async ({ input }) => {
		const id = crypto.randomUUID();

		await dbModels.create({
			id,
			name: input.name,
			provider: input.provider,
			model_id: input.modelId,
			color: input.color,
		});

		const row = await dbModels.getById(id);
		return row ? mapModel(row) : null;
	}),

	update: protectedProcedure.input(ModelUpdateSchema).handler(async ({ input }) => {
		await dbModels.update({
			id: input.id,
			name: input.name,
			provider: input.provider,
			model_id: input.modelId,
			color: input.color,
		});

		const row = await dbModels.getById(input.id);
		return row ? mapModel(row) : null;
	}),

	delete: protectedProcedure.input(ModelIdSchema).handler(async ({ input }) => {
		await dbModels.delete(input.id);
		return { success: true };
	}),

	reorder: protectedProcedure.input(ModelReorderSchema).handler(async ({ input }) => {
		await dbModels.reorder(input.orderedIds);
		return { success: true };
	}),
};
