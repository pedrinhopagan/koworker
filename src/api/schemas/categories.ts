import { z } from "zod";

import { PROMPT_TEMPLATE_SLUGS } from "@/constants/prompt-templates";

export const CategoryIdSchema = z.object({
	id: z.string().min(1),
});

export const CategoryCreateSchema = z.object({
	name: z.string().min(1),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	structureSlug: z.enum(PROMPT_TEMPLATE_SLUGS).nullable().optional(),
});

export const CategoryUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	structureSlug: z.enum(PROMPT_TEMPLATE_SLUGS).nullable().optional(),
});

export const CategoryMigrateAndDeleteSchema = z.object({
	sourceId: z.string().min(1),
	targetId: z.string().min(1),
});

export const CategoryReorderSchema = z.object({
	orderedIds: z.array(z.string().min(1)).min(1),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;
export type CategoryMigrateAndDeleteInput = z.infer<typeof CategoryMigrateAndDeleteSchema>;

export const CategoryDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().optional(),
	structure_slug: z.enum(PROMPT_TEMPLATE_SLUGS).nullable().optional(),
	display_order: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const CategoryDbUpdateSchema = CategoryDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type CategoryDbCreateInput = z.infer<typeof CategoryDbCreateSchema>;
export type CategoryDbUpdateInput = z.infer<typeof CategoryDbUpdateSchema>;
