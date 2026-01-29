import { z } from "zod";

export const CategoryIdSchema = z.object({
	id: z.string().min(1),
});

export const CategoryCreateSchema = z.object({
	name: z.string().min(1),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const CategoryUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;

export const CategoryDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const CategoryDbUpdateSchema = CategoryDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type CategoryDbCreateInput = z.infer<typeof CategoryDbCreateSchema>;
export type CategoryDbUpdateInput = z.infer<typeof CategoryDbUpdateSchema>;
