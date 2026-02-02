import { z } from "zod";

export const subtaskSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1, "Titulo e obrigatorio"),
	status: z.string(),
	order: z.number().int().min(0),
	description: z.string().nullable(),
	acceptance_criteria: z.array(z.string()).nullable(),
	technical_notes: z.string().nullable(),
	prompt_context: z.string().nullable(),
	created_at: z.string(),
	completed_at: z.string().nullable(),
});

export const taskContextSchema = z.object({
	description: z.string().nullable(),
	business_rules: z.array(z.string()),
	technical_notes: z.string().nullable(),
	acceptance_criteria: z.array(z.string()).nullable(),
});

export const aiMetadataSchema = z.object({
	last_interaction: z.string().nullable(),
	last_completed_action: z.string().nullable(),
	session_ids: z.array(z.string()),
	tokens_used: z.number().int().min(0),
	structuring_complete: z.boolean(),
});

export const taskTimestampsSchema = z.object({
	created_at: z.string(),
	started_at: z.string().nullable(),
	completed_at: z.string().nullable(),
});

export const taskFullSchema = z.object({
	schema_version: z.number().int(),
	initialized: z.boolean(),
	id: z.string().uuid(),
	title: z.string().min(1, "Titulo e obrigatorio"),
	status: z.string(),
	priority: z.number().int().min(1).max(3),
	category: z.enum(["feature", "bug", "refactor", "test", "docs"]),
	complexity: z.string().nullable(),
	context: taskContextSchema,
	subtasks: z.array(subtaskSchema),
	ai_metadata: aiMetadataSchema,
	timestamps: taskTimestampsSchema,
	modified_at: z.string().nullable().optional(),
	modified_by: z.enum(["user", "ai"]).nullable().optional(),
});

export const taskEditFormSchema = z.object({
	title: z.string().min(1, "Titulo e obrigatorio"),
	status: z.string(),
	priority: z.number().int().min(1).max(3),
	category: z.enum(["feature", "bug", "refactor", "test", "docs"]),
	complexity: z.string().nullable(),
	context: z.object({
		description: z.string().nullable(),
		business_rules: z.array(z.string()),
		technical_notes: z.string().nullable(),
		acceptance_criteria: z.array(z.string()).nullable(),
	}),
	subtasks: z.array(subtaskSchema),
	initialized: z.boolean(),
});

export const createSubtaskSchema = z.object({
	title: z.string().min(1, "Titulo da subtask e obrigatorio"),
});

export const updateTaskStatusSchema = z.object({
	status: z.enum(["pending", "in_progress", "done"]),
});

export type TaskFullSchema = z.infer<typeof taskFullSchema>;
export type TaskEditFormSchema = z.infer<typeof taskEditFormSchema>;
export type SubtaskSchema = z.infer<typeof subtaskSchema>;
export type TaskContextSchema = z.infer<typeof taskContextSchema>;
export type CreateSubtaskSchema = z.infer<typeof createSubtaskSchema>;
export type UpdateTaskStatusSchema = z.infer<typeof updateTaskStatusSchema>;
