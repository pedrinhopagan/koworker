import { z } from "zod";

export const ProjectIdSchema = z.object({
	id: z.string().uuid(),
});

export const ProjectCreateSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	mainRoute: z.string().min(1),
});

export const ProjectUpdateSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	mainRoute: z.string().min(1).optional(),
});

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;
