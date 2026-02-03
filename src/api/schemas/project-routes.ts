import { z } from "zod";

export const ProjectRouteIdSchema = z.object({
	id: z.string().min(1),
});

export const ProjectRouteCreateSchema = z.object({
	projectId: z.string().min(1),
	name: z.string().min(1).max(20),
	route: z.string().min(1),
	icon: z.string().optional(),
	command: z.string().optional(),
});

export const ProjectRouteUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(20).optional(),
	route: z.string().optional(),
	icon: z.string().optional(),
	command: z.string().optional(),
});

export const ProjectRouteReorderSchema = z.object({
	orderedIds: z.array(z.string().min(1)).min(1),
});

export type ProjectRouteCreateInput = z.infer<typeof ProjectRouteCreateSchema>;
export type ProjectRouteUpdateInput = z.infer<typeof ProjectRouteUpdateSchema>;

export const ProjectRouteDbCreateSchema = z.object({
	id: z.string().min(1),
	project_id: z.string().min(1),
	name: z.string().min(1),
	route: z.string().min(1),
	icon: z.string().optional(),
	command: z.string().optional(),
	display_order: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const ProjectRouteDbUpdateSchema = ProjectRouteDbCreateSchema.omit({
	id: true,
	project_id: true,
	created_at: true,
}).partial();

export type ProjectRouteDbCreateInput = z.infer<typeof ProjectRouteDbCreateSchema>;
export type ProjectRouteDbUpdateInput = z.infer<typeof ProjectRouteDbUpdateSchema>;

export const ProjectRouteSchema = z.object({
	id: z.string(),
	projectId: z.string(),
	name: z.string(),
	route: z.string(),
	icon: z.string().optional(),
	command: z.string().optional(),
	displayOrder: z.number().int(),
	createdAt: z.number().int(),
	updatedAt: z.number().int().optional(),
});

export type ProjectRoute = z.infer<typeof ProjectRouteSchema>;
