import { z } from "zod";
import { TaskStatusSchema } from "./tasks";

export const SubtaskIdSchema = z.object({
	id: z.string().min(1),
});

export const SubtaskListByTaskSchema = z.object({
	taskId: z.string().min(1),
});

export const SubtaskCreateSchema = z.object({
	taskId: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	status: TaskStatusSchema.optional(),
	completedAt: z.number().int().optional(),
});

export const SubtaskUpdateSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: TaskStatusSchema.optional(),
	completedAt: z.number().int().nullable().optional(),
});

export type SubtaskCreateInput = z.infer<typeof SubtaskCreateSchema>;
export type SubtaskUpdateInput = z.infer<typeof SubtaskUpdateSchema>;

export const SubtaskDbCreateSchema = z.object({
	id: z.string().min(1),
	task_id: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	status: TaskStatusSchema.optional(),
	completed_at: z.number().int().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
});

export const SubtaskDbUpdateSchema = SubtaskDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type SubtaskDbCreateInput = z.infer<typeof SubtaskDbCreateSchema>;
export type SubtaskDbUpdateInput = z.infer<typeof SubtaskDbUpdateSchema>;
