import { z } from "zod";

export const ModelIdSchema = z.object({
	id: z.string().min(1),
});

export const ModelCreateSchema = z.object({
	name: z.string().min(1),
	provider: z.string().optional(),
	modelId: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const ModelUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).optional(),
	provider: z.string().optional(),
	modelId: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const ModelReorderSchema = z.object({
	orderedIds: z.array(z.string().min(1)).min(1),
});

export type ModelCreateInput = z.infer<typeof ModelCreateSchema>;
export type ModelUpdateInput = z.infer<typeof ModelUpdateSchema>;

export const ModelDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	provider: z.string().optional(),
	model_id: z.string().optional(),
	color: z.string().optional(),
	display_order: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const ModelDbUpdateSchema = ModelDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type ModelDbCreateInput = z.infer<typeof ModelDbCreateSchema>;
export type ModelDbUpdateInput = z.infer<typeof ModelDbUpdateSchema>;
