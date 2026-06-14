import { z } from "zod";

export const SkillCategoryIdSchema = z.object({
	id: z.string().min(1),
});

export const SkillCategoryCreateSchema = z.object({
	name: z.string().trim().min(1),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const SkillCategoryUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export type SkillCategoryCreateInput = z.infer<typeof SkillCategoryCreateSchema>;
export type SkillCategoryUpdateInput = z.infer<typeof SkillCategoryUpdateSchema>;

export const SkillCategoryDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().optional(),
	display_order: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const SkillCategoryDbUpdateSchema = SkillCategoryDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type SkillCategoryDbCreateInput = z.infer<typeof SkillCategoryDbCreateSchema>;
export type SkillCategoryDbUpdateInput = z.infer<typeof SkillCategoryDbUpdateSchema>;
