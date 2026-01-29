import { z } from "zod";

export const CategoryIdSchema = z.object({
	id: z.string().uuid(),
});

export const CategoryCreateSchema = z.object({
	name: z.string().min(1),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const CategoryUpdateSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;
