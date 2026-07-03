import { z } from "zod";

import { TASK_COMPLEXITIES } from "@/constants/complexity";

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

	/**
	 * Filter by complexity.
	 *
	 * NOTE: In the DB this maps to `tasks.complexity`.
	 */
	complexity: z.enum(TASK_COMPLEXITIES).optional(),
});

export const TaskListByProjectSchema = z
	.object({
		projectId: z.string().min(1),
	})
	.merge(TaskListFiltersSchema);

// Centralized listing endpoint.
export const TaskGetAllSchema = z
	.object({
		projectId: z.string().min(1).nullable().optional(),

		// Default to the current app behavior: do NOT return completed tasks unless explicitly asked.
		includeCompleted: z.boolean().optional().default(false),
	})
	.merge(TaskListFiltersSchema);

export const TaskCreateSchema = z.object({
	projectId: z.string().trim().min(1),
	title: z.string().trim().min(1).optional(),
	// Prioridade e categoria são opcionais: omitidas, a task nasce sem nenhuma delas.
	priorityId: z.string().trim().min(1).optional(),
	categoryId: z.string().trim().min(1).optional(),
	complexity: z.enum(TASK_COMPLEXITIES).default("medio"),
	// Vincular a task a uma feature (task group) já na criação. Opcional: omitido nasce sem feature.
	groupId: z.string().trim().min(1).optional(),
	// Semeia o index.md com o título (H1). Quem cria a task só pra receber arquivos (redirecionar
	// do vault para uma tarefa nova) passa false: a pasta nasce vazia e os arquivos entram sem
	// colidir com um index.md de boilerplate.
	seed: z.boolean().optional().default(true),
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
	complexity: z.enum(TASK_COMPLEXITIES).optional(),
	done: z.boolean().optional(),
});

export const TaskSetDoneSchema = z.object({
	id: z.string().trim().min(1),
	done: z.boolean(),
	// Concluir uma tarefa "Sem feature" pode, no mesmo gesto, vinculá-la a uma feature. Omitido
	// (reabrir ou concluir sem feature) preserva o group_id atual.
	groupId: z.string().trim().min(1).optional(),
});

// Migra a tarefa para outro projeto: move a pasta `.koworker/<id>` para o main_route do destino e
// reaponta project_id. O grupo é por projeto, então a tarefa cai em "Sem grupo" no destino.
export const TaskMoveToProjectSchema = z.object({
	id: z.string().trim().min(1),
	targetProjectId: z.string().trim().min(1),
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

// Ordem manual das abas (.md) de uma task. orderedNames vem na ordem final desejada; o handler
// grava como JSON em tasks.file_order. Nomes que não existem mais na pasta são tolerados na
// leitura (a ordenação só os ignora), então não exigimos correspondência exata aqui.
export const TaskReorderFilesSchema = z.object({
	id: z.string().trim().min(1),
	orderedNames: z
		.array(
			z
				.string()
				.trim()
				.regex(/^[^/\\]+\.md$/, "File name must be a .md without path separators"),
		)
		.min(1),
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

// Nome de uma pasta solta dentro de `.koworker/`: um único segmento, sem separadores nem
// referência a pai. É boundary — vira parte de um path no FS, então rejeitamos travessia.
const vaultFolderName = z
	.string()
	.trim()
	.min(1)
	.regex(/^[^/\\]+$/, "Folder name must not contain path separators")
	.refine((name) => name !== "." && name !== "..", "Invalid folder name");

export const VaultListSchema = z.object({
	projectId: z.string().trim().min(1).optional(),
});

// Conteúdo de um único arquivo do vault, pra rota de abertura — carrega só o arquivo aberto,
// em vez de toda a lista com conteúdo.
export const VaultGetFileSchema = z.object({
	projectId: z.string().trim().min(1),
	name: mdFileName,
});

// Alvo do "copiar conteúdo": uma tarefa ou uma pasta solta. A união discriminada cruza o boundary
// uma vez; o handler resolve a pasta certa no FS pelo kind. (Nota solta copia direto na página, sem
// passar por aqui.)
export const VaultExportContentSchema = z.object({
	projectId: z.string().trim().min(1),
	target: z.discriminatedUnion("kind", [
		z.object({ kind: z.literal("task"), taskId: z.string().trim().min(1) }),
		z.object({ kind: z.literal("folder"), folderName: vaultFolderName }),
	]),
});

export const VaultWriteFileSchema = z.object({
	projectId: z.string().trim().min(1),
	name: mdFileName,
	content: z.string(),
});

export const VaultRenameFileSchema = z.object({
	projectId: z.string().trim().min(1),
	oldName: mdFileName,
	newName: mdFileName,
});

export const VaultDeleteFileSchema = z.object({
	projectId: z.string().trim().min(1),
	name: mdFileName,
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

// Arquivos já vinculados a tarefas são identificados por (taskId, name): o mesmo nome
// (ex: index.md) se repete entre tarefas, então o nome sozinho não basta.
const linkedFileRef = z.object({
	taskId: z.string().trim().min(1),
	name: mdFileName,
});

// Move arquivos vinculados de uma ou mais tarefas para a pasta de outra tarefa.
export const VaultMoveFilesToTaskSchema = z.object({
	projectId: z.string().trim().min(1),
	targetTaskId: z.string().trim().min(1),
	files: z.array(linkedFileRef).min(1),
});

// Solta arquivos vinculados de volta pra raiz do vault, fora de qualquer tarefa.
export const VaultUnlinkFilesSchema = z.object({
	projectId: z.string().trim().min(1),
	files: z.array(linkedFileRef).min(1),
});

// Adota uma pasta solta (dir em `.koworker/` sem task) como tarefa: a task nova passa a
// apontar para a pasta existente, sem mover arquivo nenhum.
export const VaultAdoptFolderSchema = z.object({
	projectId: z.string().trim().min(1),
	folderName: vaultFolderName,
});

// Move `.md` de uma pasta solta para a pasta de uma tarefa existente.
export const VaultMoveFolderFilesToTaskSchema = z.object({
	projectId: z.string().trim().min(1),
	folderName: vaultFolderName,
	targetTaskId: z.string().trim().min(1),
	files: z.array(mdFileName).min(1),
});

export const TaskRenameFileSchema = z.object({
	id: z.string().trim().min(1),
	oldName: mdFileName,
	newName: mdFileName,
});

export const TaskDeleteFileSchema = z.object({
	id: z.string().trim().min(1),
	name: mdFileName,
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
	priority_id: z.string().min(1).nullable().optional(),
	category_id: z.string().min(1).nullable().optional(),
	complexity: z.enum(TASK_COMPLEXITIES).optional(),
	group_id: z.string().min(1).nullable().optional(),
	display_order: z.number().int().optional(),
	file_order: z.string().nullable().optional(),
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
