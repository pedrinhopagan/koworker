import { protectedProcedure } from "../auth/context";
import { dbCategories } from "../db/categories";
import type { categories } from "../db/connection";
import { CategoryCreateSchema, CategoryIdSchema, CategoryUpdateSchema } from "../schemas";

const mapCategory = (row: categories) => ({
	id: row.id,
	name: row.name,
	color: row.color,
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
		await dbCategories.update({
			id: input.id,
			name: input.name,
			color: input.color,
		});

		const row = await dbCategories.getById(input.id);
		return row ? mapCategory(row) : null;
	}),
};
