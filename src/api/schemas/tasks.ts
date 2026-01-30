import { z } from "zod";

export const TaskStatusSchema = z.enum(["pending", "in_execution", "executed"]);

export const AcceptanceCriteriaItemSchema = z.object({
	id: z.string().min(1),
	text: z.string().min(1),
	done: z.boolean(),
});

export const TaskIdSchema = z.object({
	id: z.string().min(1),
});

export const TaskListByProjectSchema = z.object({
	projectId: z.string().min(1),
});

export const TaskListByDateSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export const TaskListByWeekSchema = z.object({
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

export const TaskCreateSchema = z.object({
	projectId: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	notes: z.string().optional(),
	aiMetadata: z.unknown().optional(),
	priorityId: z.string().min(1),
	categoryId: z.string().min(1),
	status: TaskStatusSchema.optional(),
	acceptanceCriteria: z.array(AcceptanceCriteriaItemSchema).optional(),
	scheduledDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
});

export const TaskUpdateSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	notes: z.string().optional(),
	aiMetadata: z.unknown().optional(),
	priorityId: z.string().min(1).optional(),
	categoryId: z.string().min(1).optional(),
	status: TaskStatusSchema.optional(),
	acceptanceCriteria: z.array(AcceptanceCriteriaItemSchema).optional(),
	scheduledDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	completedAt: z.number().int().nullable().optional(),
});

export type TaskCreateInput = z.infer<typeof TaskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;

export const TaskDbCreateSchema = z.object({
	id: z.string().min(1),
	project_id: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	notes: z.string().optional(),
	ai_metadata: z.string().optional(),
	priority_id: z.string().min(1),
	category_id: z.string().min(1),
	status: TaskStatusSchema.optional(),
	acceptance_criteria: z.string().optional(),
	scheduled_date: z.string().nullable().optional(),
	completed_at: z.number().int().nullable().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
	deleted_at: z.number().int().optional(),
});

export const TaskDbUpdateSchema = TaskDbCreateSchema.omit({
	id: true,
	created_at: true,
}).partial();

export type TaskDbCreateInput = z.infer<typeof TaskDbCreateSchema>;
export type TaskDbUpdateInput = z.infer<typeof TaskDbUpdateSchema>;

export const TaskMetricsSchema = z.object({
	projectId: z.string().min(1).nullable(),
});

export const TaskFocusSchema = z.object({
	projectId: z.string().min(1).nullable().optional(),
});
