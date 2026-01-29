import { z } from "zod";
import { TaskStatusSchema } from "./tasks";

export const SubtaskIdSchema = z.object({
	id: z.string().uuid(),
});

export const SubtaskCreateSchema = z.object({
	taskId: z.string().uuid(),
	title: z.string().min(1),
	description: z.string().optional(),
	status: TaskStatusSchema.optional(),
	completedAt: z.number().int().optional(),
});

export const SubtaskUpdateSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: TaskStatusSchema.optional(),
	completedAt: z.number().int().nullable().optional(),
});

export type SubtaskCreateInput = z.infer<typeof SubtaskCreateSchema>;
export type SubtaskUpdateInput = z.infer<typeof SubtaskUpdateSchema>;
