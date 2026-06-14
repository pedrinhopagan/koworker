import { protectedProcedure } from "../auth/context";
import type { skill_categories } from "../db/connection";
import { dbSkillCategories } from "../db/skill-categories";
import {
	SkillCategoryCreateSchema,
	SkillCategoryIdSchema,
	SkillCategoryUpdateSchema,
} from "../schemas";

const mapSkillCategory = (row: skill_categories) => ({
	id: row.id,
	name: row.name,
	color: row.color,
	displayOrder: row.display_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
});

export const skillCategoriesRouter = {
	list: protectedProcedure.handler(async () => {
		const rows = await dbSkillCategories.getAll();
		return rows.map(mapSkillCategory);
	}),

	create: protectedProcedure.input(SkillCategoryCreateSchema).handler(async ({ input }) => {
		const existing = await dbSkillCategories.findByNormalizedName(input.name);
		if (existing) {
			throw new Error("Já existe uma categoria com este nome");
		}

		const id = crypto.randomUUID();

		await dbSkillCategories.create({
			id,
			name: input.name,
			color: input.color,
		});

		const row = await dbSkillCategories.getById(id);
		return row ? mapSkillCategory(row) : null;
	}),

	update: protectedProcedure.input(SkillCategoryUpdateSchema).handler(async ({ input }) => {
		if (input.name) {
			const existing = await dbSkillCategories.findByNormalizedName(input.name, input.id);
			if (existing) {
				throw new Error("Já existe uma categoria com este nome");
			}
		}

		await dbSkillCategories.update({
			id: input.id,
			name: input.name,
			color: input.color,
		});

		const row = await dbSkillCategories.getById(input.id);
		return row ? mapSkillCategory(row) : null;
	}),

	delete: protectedProcedure.input(SkillCategoryIdSchema).handler(async ({ input }) => {
		await dbSkillCategories.delete(input.id);
		return { success: true };
	}),
};
