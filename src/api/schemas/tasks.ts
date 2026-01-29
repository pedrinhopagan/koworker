import { z } from "zod";

export const TaskStatusSchema = z.enum(["pending", "in_execution", "executed"]);

export const AcceptanceCriteriaItemSchema = z.object({
	id: z.string().min(1),
	text: z.string().min(1),
	done: z.boolean(),
});

export const TaskIdSchema = z.object({
	id: z.string().uuid(),
});

export const TaskListByProjectSchema = z.object({
	projectId: z.string().uuid(),
});

export const TaskCreateSchema = z.object({
	projectId: z.string().uuid(),
	title: z.string().min(1),
	description: z.string().optional(),
	notes: z.string().optional(),
	aiMetadata: z.unknown().optional(),
	priorityId: z.string().uuid(),
	categoryId: z.string().uuid(),
	status: TaskStatusSchema.optional(),
	acceptanceCriteria: z.array(AcceptanceCriteriaItemSchema).optional(),
});

export const TaskUpdateSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	notes: z.string().optional(),
	aiMetadata: z.unknown().optional(),
	priorityId: z.string().uuid().optional(),
	categoryId: z.string().uuid().optional(),
	status: TaskStatusSchema.optional(),
	acceptanceCriteria: z.array(AcceptanceCriteriaItemSchema).optional(),
	completedAt: z.number().int().nullable().optional(),
});

export type TaskCreateInput = z.infer<typeof TaskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;
