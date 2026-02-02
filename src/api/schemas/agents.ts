import { z } from "zod";

export const AgentIdSchema = z.object({
	id: z.string().min(1),
});

export const AgentCreateSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const AgentUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const AgentReorderSchema = z.object({
	orderedIds: z.array(z.string().min(1)).min(1),
});

export type AgentCreateInput = z.infer<typeof AgentCreateSchema>;
export type AgentUpdateInput = z.infer<typeof AgentUpdateSchema>;

export const AgentDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	color: z.string().optional(),
	display_order: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const AgentDbUpdateSchema = AgentDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type AgentDbCreateInput = z.infer<typeof AgentDbCreateSchema>;
export type AgentDbUpdateInput = z.infer<typeof AgentDbUpdateSchema>;
