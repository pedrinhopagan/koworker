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

export const TaskListFiltersSchema = z.object({
	/**
	 * Filter by the task type/category.
	 *
	 * NOTE: In the DB this maps to `tasks.category_id`.
	 */
	taskTypeId: z.string().min(1).optional(),

	/**
	 * Filter by priority.
	 *
	 * NOTE: In the DB this maps to `tasks.priority_id`.
	 */
	priority: z.string().min(1).optional(),

	status: TaskStatusSchema.optional(),
});

export const TaskListByProjectSchema = z
	.object({
		projectId: z.string().min(1),
	})
	.merge(TaskListFiltersSchema);

export const TaskListByDateSchema = z
	.object({
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
		projectId: z.string().min(1).nullable().optional(),
	})
	.merge(TaskListFiltersSchema);

export const TaskListByWeekSchema = z
	.object({
		startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
		endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
		projectId: z.string().min(1).nullable().optional(),
	})
	.merge(TaskListFiltersSchema);

// Centralized listing endpoint.
// Keep the filtering surface minimal for now; more complex filters can be added in phase-5-tarefa-2.
export const TaskGetAllSchema = z
	.object({
		projectId: z.string().min(1).nullable().optional(),
		date: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
			.optional(),
		startDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
			.optional(),
		endDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
			.optional(),

		// Default to the current app behavior: do NOT return completed tasks unless explicitly asked.
		includeCompleted: z.boolean().optional().default(false),
	})
	.merge(TaskListFiltersSchema)
	.refine(
		(v) => {
			// Either a specific date OR a range; if both provided, date wins at handler level.
			if (v.startDate || v.endDate) return Boolean(v.startDate && v.endDate);
			return true;
		},
		{ message: "startDate and endDate must be provided together" },
	);

export const TaskCreateSchema = z.object({
	projectId: z.string().trim().min(1),
	title: z.string().trim().min(1),
	description: z.string().optional(),
	notes: z.string().optional(),
	aiMetadata: z.unknown().optional(),
	priorityId: z.string().trim().min(1),
	categoryId: z.string().trim().min(1),
	status: TaskStatusSchema.optional(),
	acceptanceCriteria: z.array(AcceptanceCriteriaItemSchema).optional(),
	scheduledDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
});

export const TaskUpdateSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1).optional(),
	description: z.string().optional(),
	notes: z.string().optional(),
	aiMetadata: z.unknown().optional(),
	priorityId: z.string().trim().min(1).optional(),
	categoryId: z.string().trim().min(1).optional(),
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

export type TaskListFiltersInput = z.infer<typeof TaskListFiltersSchema>;

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
