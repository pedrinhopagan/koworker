import { protectedProcedure } from "../auth/context";
import { dbCategories } from "../db/categories";
import type { categories } from "../db/connection";
import {
	CategoryCreateSchema,
	CategoryIdSchema,
	CategoryMigrateAndDeleteSchema,
	CategoryReorderSchema,
	CategoryUpdateSchema,
} from "../schemas";

const mapCategory = (row: categories) => ({
	id: row.id,
	name: row.name,
	color: row.color,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

export const categoriesRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbCategories.getAll();
		return rows.map(mapCategory);
	}),

	getById: protectedProcedure.input(CategoryIdSchema).handler(async ({ input }) => {
		const row = await dbCategories.getById(input.id);
		return row ? mapCategory(row) : null;
	}),

	create: protectedProcedure.input(CategoryCreateSchema).handler(async ({ input }) => {
		const existing = await dbCategories.findByNormalizedName(input.name);
		if (existing) {
			throw new Error("Já existe uma categoria com este nome");
		}

		const id = crypto.randomUUID();

		await dbCategories.create({
			id,
			name: input.name,
			color: input.color,
		});

		const row = await dbCategories.getById(id);
		return row ? mapCategory(row) : null;
	}),

	update: protectedProcedure.input(CategoryUpdateSchema).handler(async ({ input }) => {
		if (input.name) {
			const existing = await dbCategories.findByNormalizedName(input.name, input.id);
			if (existing) {
				throw new Error("Já existe uma categoria com este nome");
			}
		}

		await dbCategories.update({
			id: input.id,
			name: input.name,
			color: input.color,
		});

		const row = await dbCategories.getById(input.id);
		return row ? mapCategory(row) : null;
	}),

	delete: protectedProcedure.input(CategoryIdSchema).handler(async ({ input }) => {
		await dbCategories.delete(input.id);
		return { success: true };
	}),

	reorder: protectedProcedure.input(CategoryReorderSchema).handler(async ({ input }) => {
		await dbCategories.reorder(input.orderedIds);
		return { success: true };
	}),

	hasAssociatedTasks: protectedProcedure.input(CategoryIdSchema).handler(({ input }) => {
		return dbCategories.hasAssociatedTasks(input.id);
	}),

	migrateAndDelete: protectedProcedure
		.input(CategoryMigrateAndDeleteSchema)
		.handler(async ({ input }) => {
			await dbCategories.migrateTasksToCategory(input.sourceId, input.targetId);
			await dbCategories.delete(input.sourceId);
			return { success: true };
		}),
};
