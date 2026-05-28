import { z } from "zod";

export const TaskIdSchema = z.object({
	id: z.string().min(1),
});

export const TaskListFiltersSchema = z.object({
	q: z.string().trim().min(1).optional(),
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
	priorityId: z.string().min(1).optional(),
	priority: z.string().min(1).optional(),
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
			if (v.startDate || v.endDate) return Boolean(v.startDate && v.endDate);
			return true;
		},
		{ message: "startDate and endDate must be provided together" },
	);

export const TaskCreateSchema = z.object({
	projectId: z.string().trim().min(1),
	title: z.string().trim().min(1).optional(),
	priorityId: z.string().trim().min(1),
	categoryId: z.string().trim().min(1),
	scheduledDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	scheduledTime: z
		.string()
		.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
		.nullable()
		.optional(),
});

export const TaskUpdateSchema = z.object({
	id: z.string().trim().min(1),
	// Limpar o título (input vazio) volta a task pro fallback: o boundary normaliza "" → null.
	title: z
		.string()
		.trim()
		.nullable()
		.optional()
		.transform((v) => (v === "" ? null : v)),
	priorityId: z.string().trim().min(1).optional(),
	categoryId: z.string().trim().min(1).optional(),
	scheduledDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	scheduledTime: z
		.string()
		.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
		.nullable()
		.optional(),
	done: z.boolean().optional(),
});

export const TaskSetDoneSchema = z.object({
	id: z.string().trim().min(1),
	done: z.boolean(),
});

// Reordena/recoloca um bucket inteiro. As ids vêm na ordem final desejada; o handler grava
// display_order = índice e fixa group_id nelas. categoryId só é enviado quando o destino é um
// cluster de categoria (modo Categoria); nos modos achatados é omitido para preservar a
// categoria de cada task. groupId nulo é o pseudo-grupo "Sem grupo".
export const TaskReorderSchema = z.object({
	groupId: z.string().trim().min(1).nullable(),
	categoryId: z.string().trim().min(1).optional(),
	orderedIds: z.array(z.string().min(1)).min(1),
});

export const TaskWriteFileSchema = z.object({
	id: z.string().trim().min(1),
	// Nome do arquivo dentro da pasta da task, ex: "index.md". Sem separadores de caminho.
	name: z
		.string()
		.trim()
		.regex(/^[^/\\]+\.md$/, "File name must be a .md without path separators"),
	content: z.string(),
});

const mdFileName = z
	.string()
	.trim()
	.regex(/^[^/\\]+\.md$/, "File name must be a .md without path separators");

export const VaultListSchema = z.object({
	projectId: z.string().trim().min(1),
});

export const VaultWriteFileSchema = z.object({
	projectId: z.string().trim().min(1),
	name: mdFileName,
	content: z.string(),
});

export const TaskPromoteSchema = z.object({
	projectId: z.string().trim().min(1),
	name: mdFileName,
});

// Move um ou mais `.md` soltos do vault para a pasta de uma tarefa. targetName só faz
// sentido quando há um único arquivo (renomear ao arquivar); com vários, cada um mantém o nome.
export const VaultLinkFilesToTaskSchema = z.object({
	projectId: z.string().trim().min(1),
	taskId: z.string().trim().min(1),
	files: z
		.array(
			z.object({
				name: mdFileName,
				targetName: mdFileName.optional(),
			}),
		)
		.min(1),
});

export const TaskRenameFileSchema = z.object({
	id: z.string().trim().min(1),
	oldName: mdFileName,
	newName: mdFileName,
});

// Sobrescreve a data de atualização (mtime) de um .md. editedAt em ms desde a epoch — instante
// escolhido pelo usuário pra reordenar a recência sem editar o conteúdo.
export const TaskSetFileDateSchema = z.object({
	id: z.string().trim().min(1),
	name: mdFileName,
	editedAt: z.number().int().positive(),
});

export type TaskCreateInput = z.infer<typeof TaskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;
export type TaskSetDoneInput = z.infer<typeof TaskSetDoneSchema>;
export type TaskWriteFileInput = z.infer<typeof TaskWriteFileSchema>;
export type TaskListFiltersInput = z.infer<typeof TaskListFiltersSchema>;

export const TaskDbCreateSchema = z.object({
	id: z.string().min(1),
	project_id: z.string().min(1),
	folder_path: z.string().min(1),
	title: z.string().min(1).optional(),
	priority_id: z.string().min(1),
	category_id: z.string().min(1),
	group_id: z.string().min(1).nullable().optional(),
	display_order: z.number().int().optional(),
	scheduled_date: z.string().nullable().optional(),
	scheduled_time: z.string().nullable().optional(),
	done: z.number().int().optional(),
	completed_at: z.number().int().nullable().optional(),
	created_at: z.number().int().optional(),
	updated_at: z.number().int().optional(),
	deleted_at: z.number().int().optional(),
});

export const TaskDbUpdateSchema = TaskDbCreateSchema.omit({
	id: true,
	created_at: true,
})
	.partial()
	// title nullable no update: gravar null limpa o título e devolve a task pro fallback.
	.extend({ title: z.string().min(1).nullable().optional() });

export type TaskDbCreateInput = z.infer<typeof TaskDbCreateSchema>;
export type TaskDbUpdateInput = z.infer<typeof TaskDbUpdateSchema>;

export const TaskMetricsSchema = z.object({
	projectId: z.string().min(1).nullable(),
});

export const TaskFocusSchema = z.object({
	projectId: z.string().min(1).nullable().optional(),
});
