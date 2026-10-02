import { z } from "zod";

export const AgentCategoryIdSchema = z.object({
	id: z.string().min(1),
});

export const AgentCategoryCreateSchema = z.object({
	name: z.string().trim().min(1),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const AgentCategoryUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export type AgentCategoryCreateInput = z.infer<typeof AgentCategoryCreateSchema>;
export type AgentCategoryUpdateInput = z.infer<typeof AgentCategoryUpdateSchema>;

export const AgentCategoryDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().optional(),
	display_order: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const AgentCategoryDbUpdateSchema = AgentCategoryDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type AgentCategoryDbCreateInput = z.infer<typeof AgentCategoryDbCreateSchema>;
export type AgentCategoryDbUpdateInput = z.infer<typeof AgentCategoryDbUpdateSchema>;
