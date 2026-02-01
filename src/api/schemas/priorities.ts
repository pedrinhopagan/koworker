import { z } from "zod";

export const PriorityIdSchema = z.object({
	id: z.string().min(1),
});

export const PriorityCreateSchema = z.object({
	name: z.string().min(1),
	level: z.number().int().min(1).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const PriorityUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).optional(),
	level: z.number().int().min(1).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const PriorityReorderSchema = z.object({
	orderedIds: z.array(z.string().min(1)).min(1),
});

export const PriorityMigrateAndDeleteSchema = z.object({
	sourceId: z.string().min(1),
	targetId: z.string().min(1),
});

export type PriorityCreateInput = z.infer<typeof PriorityCreateSchema>;
export type PriorityUpdateInput = z.infer<typeof PriorityUpdateSchema>;

export const PriorityDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	level: z.number().int().optional(),
	color: z.string().optional(),
	display_order: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const PriorityDbUpdateSchema = PriorityDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type PriorityDbCreateInput = z.infer<typeof PriorityDbCreateSchema>;
export type PriorityDbUpdateInput = z.infer<typeof PriorityDbUpdateSchema>;
