import { z } from "zod";

export const PriorityIdSchema = z.object({
	id: z.string().uuid(),
});

export const PriorityCreateSchema = z.object({
	name: z.string().min(1),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const PriorityUpdateSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type PriorityCreateInput = z.infer<typeof PriorityCreateSchema>;
export type PriorityUpdateInput = z.infer<typeof PriorityUpdateSchema>;
