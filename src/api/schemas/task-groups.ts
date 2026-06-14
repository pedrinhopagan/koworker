import { z } from "zod";

export const TaskGroupIdSchema = z.object({
	id: z.string().min(1),
});

export const TaskGroupListSchema = z.object({
	projectId: z.string().min(1).optional(),
});

export const TaskGroupCreateSchema = z.object({
	projectId: z.string().trim().min(1),
	name: z.string().trim().min(1),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const TaskGroupUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(),
});

export const TaskGroupReorderSchema = z.object({
	orderedIds: z.array(z.string().min(1)).min(1),
});

export type TaskGroupCreateInput = z.infer<typeof TaskGroupCreateSchema>;
export type TaskGroupUpdateInput = z.infer<typeof TaskGroupUpdateSchema>;

export const TaskGroupDbCreateSchema = z.object({
	id: z.string().min(1),
	project_id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().optional(),
	display_order: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const TaskGroupDbUpdateSchema = TaskGroupDbCreateSchema.omit({
	id: true,
	project_id: true,
	created_at: true,
}).partial();

export type TaskGroupDbCreateInput = z.infer<typeof TaskGroupDbCreateSchema>;
export type TaskGroupDbUpdateInput = z.infer<typeof TaskGroupDbUpdateSchema>;
