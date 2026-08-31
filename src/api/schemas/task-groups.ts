import { z } from "zod";

const TaskGroupColorSchema = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/)
	.refine((color) => color.toLowerCase() !== "#000000", "A cor da feature não pode ser preta");

export const TaskGroupIdSchema = z.object({
	id: z.string().min(1),
});

export const TaskGroupListSchema = z.object({
	projectId: z.string().min(1).optional(),
});

export const TaskGroupFolderSchema = z.object({
	projectId: z.string().min(1),
	featureId: z.string().min(1).nullable(),
});

export const TaskGroupCreateSchema = z.object({
	projectId: z.string().trim().min(1),
	name: z.string().trim().min(1),
	color: TaskGroupColorSchema.optional(),
});

export const TaskGroupUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).optional(),
	color: TaskGroupColorSchema.optional(),
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
	storage_key: z.string().min(8).optional(),
	storage_slug: z.string().min(1).optional(),
	color: TaskGroupColorSchema.optional(),
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
