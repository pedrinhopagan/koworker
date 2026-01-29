import { z } from "zod";

export const ProjectIdSchema = z.object({
	id: z.string().min(1),
});

export const ProjectCreateSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	mainRoute: z.string().min(1),
});

export const ProjectUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
	mainRoute: z.string().min(1).optional(),
});

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;

export const ProjectDbCreateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	color: z.string().optional(),
	main_route: z.string().min(1),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
	deleted_at: z.number().int().optional(),
});

export const ProjectDbUpdateSchema = ProjectDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type ProjectDbCreateInput = z.infer<typeof ProjectDbCreateSchema>;
export type ProjectDbUpdateInput = z.infer<typeof ProjectDbUpdateSchema>;
