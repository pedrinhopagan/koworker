import { join } from "node:path";

import { type TaskComplexity } from "@/constants/complexity";
import { protectedProcedure } from "../auth/context";
import { dbCategories } from "../db/categories";
import type { tasks } from "../db/connection";
import { dbPriorities } from "../db/priorities";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { listTaskAttachments } from "../helpers/koworker-assets";
import { openInFileManager } from "../helpers/os-actions";
import {
	buildFolderPath,
	createTaskFolder,
	deleteTaskFile,
	inferTaskStage,
	moveTaskFolderToProject,
	parseTaskFileOrder,
	readFirstMarkdownContent,
	readTaskFiles,
	readTaskFolderMeta,
	removeTaskFolder,
	renameTaskFile,
	resolveDisplayTitle,
	setTaskFileEditedAt,
	writeTaskFile,
} from "../helpers/task-folder";
import { restartTasksWatcher } from "../helpers/tasks-watcher";
import { PubSub } from "../pubsub";
import {
	TaskCreateSchema,
	TaskDeleteFileSchema,
	TaskFocusSchema,
	TaskGetAllSchema,
	TaskIdSchema,
	TaskListByProjectSchema,
	TaskMetricsSchema,
	TaskMoveToProjectSchema,
	TaskOpenArtifactSchema,
	TaskRenameFileSchema,
	TaskReorderFilesSchema,
	TaskReorderSchema,
	TaskSetDoneSchema,
	TaskSetFileDateSchema,
	TaskUpdateSchema,
	TaskWriteFileSchema,
} from "../schemas";

const mapTask = (
	row: tasks,
	display: { title: string; fromContent: boolean },
	meta: { fileNames?: string[]; artifactNames?: string[]; lastEditedAt?: number } = {},
) => ({
	id: row.id,
	projectId: row.project_id,
	folderPath: row.folder_path,
	title: row.title ?? undefined,
	displayTitle: display.title,
	// O displayTitle veio do início do 1º .md (a task não tem título). A UI usa isso pra
	// explicar, na edição do nome, que o texto mostrado é só o começo do conteúdo.
	titleFromContent: display.fromContent,
	priorityId: row.priority_id ?? undefined,
	categoryId: row.category_id ?? undefined,
	// O banco guarda texto livre; a garantia do conjunto vem da boundary zod na escrita. Único
	// ponto onde a coluna larga vira a união — os consumidores confiam neste tipo.
	complexity: row.complexity as TaskComplexity,
	groupId: row.group_id ?? undefined,
	displayOrder: row.display_order,
	done: Boolean(row.done),
	completedAt: row.completed_at ?? undefined,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
	deletedAt: row.deleted_at ?? undefined,
	// Última edição em disco dos .md da task; base do destaque de recência na lista. Sem .md,
	// cai no created_at (não no updated_at: mexer em metadados não é "editar o arquivo").
	lastEditedAt: meta.lastEditedAt ?? row.created_at,
	fileNames: meta.fileNames ?? [],
	artifactNames: meta.artifactNames ?? [],
});

// Resolve o displayTitle e os nomes dos .md de uma única row.
async function mapTaskWithDisplay(row: tasks) {
	const project = await dbProjects.getById(row.project_id);
	const meta = project
		? await readTaskFolderMeta({
				projectRoute: project.main_route,
				folderPath: row.folder_path,
			})
		: { fileNames: [] };

	const title = row.title?.trim();
	if (title) return mapTask(row, { title, fromContent: false }, meta);

	const firstContent = project
		? await readFirstMarkdownContent({
				projectRoute: project.main_route,
				folderPath: row.folder_path,
			})
		: undefined;
	return mapTask(row, resolveDisplayTitle({ firstContent }), meta);
}

// Resolve o displayTitle de várias rows de uma vez: carrega os projetos das tasks sem título
// uma vez e lê o 1º .md de cada. Rows com título não tocam o disco.
export async function mapTasks(rows: tasks[]) {
	const projectIds = [...new Set(rows.map((row) => row.project_id))];
	const projects = new Map(
		(await Promise.all(projectIds.map((id) => dbProjects.getById(id))))
			.filter((project) => project !== null)
			.map((project) => [project.id, project] as const),
	);

	const metaByTask = new Map(
		await Promise.all(
			rows.map(async (row) => {
				const project = projects.get(row.project_id);
				const meta = project
					? await readTaskFolderMeta({
							projectRoute: project.main_route,
							folderPath: row.folder_path,
						})
					: { fileNames: [] };
				return [row.id, meta] as const;
			}),
		),
	);

	const untitled = rows.filter((row) => !row.title?.trim());
	const firstContentByTask = new Map(
		await Promise.all(
			untitled.map(async (row) => {
				const project = projects.get(row.project_id);
				const content = project
					? await readFirstMarkdownContent({
							projectRoute: project.main_route,
							folderPath: row.folder_path,
						})
					: undefined;
				return [row.id, content] as const;
			}),
		),
	);

	return rows.map((row) => {
		const meta = metaByTask.get(row.id) ?? { fileNames: [] };
		const title = row.title?.trim();
		if (title) return mapTask(row, { title, fromContent: false }, meta);
		return mapTask(
			row,
			resolveDisplayTitle({ firstContent: firstContentByTask.get(row.id) }),
			meta,
		);
	});
}

async function publishTaskEvent(
	taskId: string,
	projectId: string,
	action: "created" | "updated" | "deleted",
) {
	await PubSub.publish("tasks", projectId, { taskId, projectId, action, source: "api" });
	await PubSub.publish("tasks", "global", { taskId, projectId, action, source: "api" });
}

export const tasksRouter = {
	metrics: protectedProcedure.input(TaskMetricsSchema).handler(async ({ input }) => {
		const result = await dbTasks.getMetrics(input.projectId);
		return {
			total: result?.total ?? 0,
			pending: result?.pending ?? 0,
			done: result?.done ?? 0,
		};
	}),

	focus: protectedProcedure.input(TaskFocusSchema).handler(async ({ input }) => {
		const row = await dbTasks.getFocusTask(input.projectId ?? null);
		if (!row) return null;
		return mapTaskWithDisplay(row);
	}),

	getAll: protectedProcedure.input(TaskGetAllSchema).handler(async ({ input }) => {
		const rows = await dbTasks.getAll({
			projectId: input.projectId ?? null,
			includeCompleted: input.includeCompleted,
			taskTypeId: input.taskTypeId,
			priorityId: input.priorityId,
			priority: input.priority,
			complexity: input.complexity,
			q: input.q,
		});

		return mapTasks(rows);
	}),

	listByProject: protectedProcedure.input(TaskListByProjectSchema).handler(async ({ input }) => {
		const rows = await dbTasks.listByProject(input);
		return mapTasks(rows);
	}),

	getById: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		return row ? mapTaskWithDisplay(row) : null;
	}),

	getFull: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) return null;

		const [category, priority, project] = await Promise.all([
			row.category_id ? dbCategories.getById(row.category_id) : null,
			row.priority_id ? dbPriorities.getById(row.priority_id) : null,
			dbProjects.getById(row.project_id),
		]);

		const { files } = project
			? await readTaskFiles({
					projectRoute: project.main_route,
					folderPath: row.folder_path,
					order: parseTaskFileOrder(row.file_order),
				})
			: { files: [] };

		const display = resolveDisplayTitle({
			title: row.title ?? undefined,
			firstContent: files.at(0)?.content,
		});

		const fileNames = files.map((file) => file.name);
		const attachments = project
			? await listTaskAttachments({ projectRoute: project.main_route, folderPath: row.folder_path })
			: [];
		const base = mapTask(row, display, {
			fileNames,
			artifactNames: attachments.map((attachment) => attachment.name),
		});

		return {
			...base,
			// Próximo passo do fluxo da complexidade, inferido dos artefatos em disco. Alimenta o chip
			// de invocação sugerida e a cabeça do prompt; o agente não relê o banco.
			nextStage: inferTaskStage({ fileNames, complexity: base.complexity }),
			files,
			attachments,
			category: category
				? {
						id: category.id,
						name: category.name,
						color: category.color,
						structureSlug: category.structure_slug ?? null,
					}
				: null,
			priority: priority
				? { id: priority.id, name: priority.name, color: priority.color, level: priority.level }
				: null,
			project: project
				? {
						id: project.id,
						name: project.name,
						color: project.color,
						mainRoute: project.main_route,
					}
				: null,
		};
	}),

	// Abre um anexo da pasta da tarefa no app padrão do SO. O path absoluto nasce e morre aqui; o
	// front só manda id + nome. Valida que o nome está entre os anexos detectados.
	openArtifact: protectedProcedure.input(TaskOpenArtifactSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		const project = await dbProjects.getById(row.project_id);
		if (!project) throw new Error("Projeto não encontrado");

		const attachments = await listTaskAttachments({
			projectRoute: project.main_route,
			folderPath: row.folder_path,
		});
		if (!attachments.some((attachment) => attachment.name === input.name)) {
			throw new Error("Arquivo não encontrado");
		}

		openInFileManager(join(project.main_route, row.folder_path, input.name));

		return { ok: true };
	}),

	create: protectedProcedure.input(TaskCreateSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const id = crypto.randomUUID();
		const folderPath = buildFolderPath(id);

		await createTaskFolder({
			projectRoute: project.main_route,
			folderPath,
			title: input.title,
			seed: input.seed,
		});

		await dbTasks.create({
			id,
			project_id: input.projectId,
			folder_path: folderPath,
			title: input.title,
			priority_id: input.priorityId,
			category_id: input.categoryId,
			complexity: input.complexity,
			group_id: input.groupId,
		});

		await publishTaskEvent(id, input.projectId, "created");
		// A pasta `.koworker/` do projeto pode ter acabado de nascer; ressintoniza o watcher.
		restartTasksWatcher();

		const row = await dbTasks.getById(id);
		return row ? mapTaskWithDisplay(row) : null;
	}),

	update: protectedProcedure.input(TaskUpdateSchema).handler(async ({ input }) => {
		await dbTasks.update({
			id: input.id,
			title: input.title,
			priority_id: input.priorityId,
			category_id: input.categoryId,
			complexity: input.complexity,
			done: input.done === undefined ? undefined : input.done ? 1 : 0,
			completed_at: input.done === undefined ? undefined : input.done ? Date.now() : null,
		});

		const row = await dbTasks.getById(input.id);
		if (row) {
			await publishTaskEvent(row.id, row.project_id, "updated");
		}
		return row ? mapTaskWithDisplay(row) : null;
	}),

	setDone: protectedProcedure.input(TaskSetDoneSchema).handler(async ({ input }) => {
		await dbTasks.update({
			id: input.id,
			done: input.done ? 1 : 0,
			completed_at: input.done ? Date.now() : null,
			// undefined cai fora do cleanUpdate e preserva o group_id atual.
			group_id: input.groupId,
		});

		const row = await dbTasks.getById(input.id);
		if (row) {
			await publishTaskEvent(row.id, row.project_id, "updated");
		}
		return row ? mapTaskWithDisplay(row) : null;
	}),

	moveToProject: protectedProcedure.input(TaskMoveToProjectSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");
		if (row.project_id === input.targetProjectId) return mapTaskWithDisplay(row);

		const [source, target] = await Promise.all([
			dbProjects.getById(row.project_id),
			dbProjects.getById(input.targetProjectId),
		]);
		if (!target) throw new Error("Projeto de destino não encontrado");

		// Move a pasta primeiro (FS antes do banco). Sem `source` não há de onde mover.
		if (source) {
			await moveTaskFolderToProject({
				fromRoute: source.main_route,
				toRoute: target.main_route,
				folderPath: row.folder_path,
			});
		}

		// Grupos são por projeto: a tarefa cai em "Sem grupo" no destino. cleanUpdate só descarta
		// undefined, então o group_id null é gravado de fato. Se a gravação falhar com a pasta já no
		// destino, desfaz o movimento — senão a tarefa apontaria pra um caminho vazio (arquivos
		// "sumidos"). O move é destrutivo, ao contrário de `create`, que só deixaria um órfão inócuo.
		try {
			await dbTasks.update({
				id: row.id,
				project_id: input.targetProjectId,
				group_id: null,
			});
		} catch (err) {
			if (source) {
				await moveTaskFolderToProject({
					fromRoute: target.main_route,
					toRoute: source.main_route,
					folderPath: row.folder_path,
				});
			}
			throw err;
		}

		await publishTaskEvent(row.id, row.project_id, "deleted");
		await publishTaskEvent(row.id, input.targetProjectId, "created");
		// O `.koworker/` do destino pode ter acabado de nascer; ressintoniza o watcher.
		restartTasksWatcher();

		const updated = await dbTasks.getById(row.id);
		return updated ? mapTaskWithDisplay(updated) : null;
	}),

	reorder: protectedProcedure.input(TaskReorderSchema).handler(async ({ input }) => {
		await dbTasks.reorder({
			groupId: input.groupId,
			categoryId: input.categoryId,
			orderedIds: input.orderedIds,
		});

		const first = await dbTasks.getById(input.orderedIds[0]);
		if (first) {
			await publishTaskEvent(first.id, first.project_id, "updated");
		}
		return { success: true };
	}),

	writeFile: protectedProcedure.input(TaskWriteFileSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		const project = await dbProjects.getById(row.project_id);
		if (!project) throw new Error("Projeto não encontrado");

		await writeTaskFile({
			projectRoute: project.main_route,
			folderPath: row.folder_path,
			name: input.name,
			content: input.content,
		});

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, name: input.name };
	}),

	setFileDate: protectedProcedure.input(TaskSetFileDateSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		const project = await dbProjects.getById(row.project_id);
		if (!project) throw new Error("Projeto não encontrado");

		await setTaskFileEditedAt({
			projectRoute: project.main_route,
			folderPath: row.folder_path,
			name: input.name,
			editedAt: input.editedAt,
		});

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, name: input.name, editedAt: input.editedAt };
	}),

	renameFile: protectedProcedure.input(TaskRenameFileSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		const project = await dbProjects.getById(row.project_id);
		if (!project) throw new Error("Projeto não encontrado");

		// Renomear não muda o tipo do arquivo: a extensão de newName tem de casar com a de oldName.
		const extOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();
		if (extOf(input.oldName) !== extOf(input.newName)) {
			throw new Error("O novo nome deve manter a mesma extensão do arquivo");
		}

		await renameTaskFile({
			projectRoute: project.main_route,
			folderPath: row.folder_path,
			oldName: input.oldName,
			newName: input.newName,
		});

		// Renomear preserva a posição na aba: troca o nome no file_order in-place. Sem isso o
		// arquivo cairia como leftover e pularia pra direita.
		const order = parseTaskFileOrder(row.file_order);
		const at = order.indexOf(input.oldName);
		if (at >= 0) {
			order[at] = input.newName;
			await dbTasks.update({ id: row.id, file_order: JSON.stringify(order) });
		}

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, oldName: input.oldName, newName: input.newName };
	}),

	deleteFile: protectedProcedure.input(TaskDeleteFileSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		const project = await dbProjects.getById(row.project_id);
		if (!project) throw new Error("Projeto não encontrado");

		await deleteTaskFile({
			projectRoute: project.main_route,
			folderPath: row.folder_path,
			name: input.name,
		});

		const order = parseTaskFileOrder(row.file_order);
		const next = order.filter((name) => name !== input.name);
		if (next.length !== order.length) {
			await dbTasks.update({ id: row.id, file_order: JSON.stringify(next) });
		}

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, name: input.name };
	}),

	reorderFiles: protectedProcedure.input(TaskReorderFilesSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		await dbTasks.update({ id: input.id, file_order: JSON.stringify(input.orderedNames) });

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, orderedNames: input.orderedNames };
	}),

	remove: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		await dbTasks.softDelete(input.id);

		if (row) {
			const project = await dbProjects.getById(row.project_id);
			if (project) {
				await removeTaskFolder({
					projectRoute: project.main_route,
					folderPath: row.folder_path,
				});
			}
			await publishTaskEvent(row.id, row.project_id, "deleted");
		}
		return { id: input.id };
	}),
};
