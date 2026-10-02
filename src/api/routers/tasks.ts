import { join } from "node:path";

import { RECENCY_IGNORE_OFFSET_MS } from "@/constants/tasks";
import { protectedProcedure } from "../auth/context";
import type { tasks } from "../db/connection";
import { dbProjects } from "../db/projects";
import { dbTaskGroups } from "../db/task-groups";
import { dbTasks } from "../db/tasks";
import { listTaskAttachments } from "../helpers/koworker-assets";
import { openFileInDefaultApp } from "../helpers/os-actions";
import { createTask } from "../helpers/task-creation";
import { getRecentTasks, mapTask, mapTasks, mapTaskWithDisplay } from "../helpers/task-display";
import {
	deleteTaskFile,
	parseTaskFileOrder,
	readTaskFiles,
	renameTaskFile,
	resolveDisplayTitle,
	setTaskFileEditedAt,
	shiftTaskFolderEditedAt,
	writeTaskFile,
} from "../helpers/task-folder";
import {
	quarantineTaskStorage,
	relinkTasks,
	restoreTaskStorage,
	withProjectStorageLock,
} from "../helpers/task-storage-coordinator";
import { createDiscoveredTasks, discoverTaskFolders } from "../helpers/task-sync";
import { CLEARED_TASK_WORKTREE_METADATA } from "../helpers/task-worktree";
import { restartTasksWatcher } from "../helpers/tasks-watcher";
import { PubSub } from "../pubsub";
import {
	TaskCreateSchema,
	TaskDeleteFileSchema,
	TaskFocusSchema,
	TaskGetAllSchema,
	TaskIdSchema,
	TaskIgnoreRecencySchema,
	TaskListByProjectSchema,
	TaskRecentSchema,
	TaskMetricsSchema,
	TaskMoveToFeatureSchema,
	TaskMoveToProjectSchema,
	TaskOpenArtifactSchema,
	TaskRenameFileSchema,
	TaskReorderFilesSchema,
	TaskReorderSchema,
	TaskSetDoneSchema,
	TaskSetFileDateSchema,
	TaskSyncCreateSchema,
	TaskSyncDiscoverSchema,
	TaskUpdateSchema,
	TaskWriteFileSchema,
} from "../schemas";

async function publishTaskEvent(
	taskId: string,
	projectId: string,
	action: "created" | "updated" | "deleted",
) {
	await PubSub.publish("tasks", projectId, { taskId, projectId, action, source: "api" });
	await PubSub.publish("tasks", "global", { taskId, projectId, action, source: "api" });
}

async function withTaskStorageMutation<T>(
	row: tasks,
	operation: (project: NonNullable<Awaited<ReturnType<typeof dbProjects.getById>>>) => Promise<T>,
) {
	const project = await dbProjects.getById(row.project_id);
	if (!project) throw new Error("Projeto não encontrado");
	return withProjectStorageLock(
		{ projectId: project.id, projectRoute: project.main_route, task: row },
		() => operation(project),
	);
}

export const tasksRouter = {
	discoverSync: protectedProcedure
		.input(TaskSyncDiscoverSchema)
		.handler(({ input }) => discoverTaskFolders(input.projectId)),

	createSync: protectedProcedure
		.input(TaskSyncCreateSchema)
		.handler(({ input }) => createDiscoveredTasks(input)),

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

	recent: protectedProcedure.input(TaskRecentSchema).handler(({ input }) => getRecentTasks(input)),

	getAll: protectedProcedure.input(TaskGetAllSchema).handler(async ({ input }) => {
		const rows = await dbTasks.getAll({
			projectId: input.projectId ?? null,
			includeCompleted: input.includeCompleted,
			groupId: input.groupId,
			q: input.q,
			limit: input.limit,
			offset: input.offset,
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

		const project = await dbProjects.getById(row.project_id);

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
			files,
			attachments,
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

		await openFileInDefaultApp(join(project.main_route, row.folder_path, input.name));

		return { ok: true };
	}),

	create: protectedProcedure.input(TaskCreateSchema).handler(async ({ input }) => {
		const row = await createTask(input);
		return row ? mapTaskWithDisplay(row) : null;
	}),

	update: protectedProcedure.input(TaskUpdateSchema).handler(async ({ input }) => {
		const current = await dbTasks.getById(input.id);
		if (!current) throw new Error("Tarefa não encontrada");
		await withTaskStorageMutation(current, () =>
			dbTasks.update({
				id: input.id,
				title: input.title,
				done: input.done === undefined ? undefined : input.done ? 1 : 0,
				completed_at: input.done === undefined ? undefined : input.done ? Date.now() : null,
				...(input.done ? CLEARED_TASK_WORKTREE_METADATA : {}),
			}),
		);

		const row = await dbTasks.getById(input.id);
		if (row) {
			await publishTaskEvent(row.id, row.project_id, "updated");
		}
		return row ? mapTaskWithDisplay(row) : null;
	}),

	setDone: protectedProcedure.input(TaskSetDoneSchema).handler(async ({ input }) => {
		const current = await dbTasks.getById(input.id);
		if (!current) throw new Error("Tarefa não encontrada");
		const project = await dbProjects.getById(current.project_id);
		if (!project) throw new Error("Projeto não encontrado");

		let row;
		if (input.groupId !== undefined && input.groupId !== current.group_id) {
			[row] = await relinkTasks({
				intents: [
					{
						taskId: current.id,
						targetProjectId: current.project_id,
						targetGroupId: input.groupId,
						done: input.done,
						completedAt: input.done ? Date.now() : null,
						clearMergeMetadata: input.done,
					},
				],
			});
		} else {
			await withProjectStorageLock(
				{ projectId: project.id, projectRoute: project.main_route },
				() =>
					dbTasks.update({
						id: input.id,
						done: input.done ? 1 : 0,
						completed_at: input.done ? Date.now() : null,
						...(input.done ? CLEARED_TASK_WORKTREE_METADATA : {}),
					}),
			);
			row = await dbTasks.getById(input.id);
		}

		if (row) {
			await publishTaskEvent(row.id, row.project_id, "updated");
		}
		return row ? mapTaskWithDisplay(row) : null;
	}),

	ignoreRecency: protectedProcedure.input(TaskIgnoreRecencySchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		await withTaskStorageMutation(row, async (project) => {
			await shiftTaskFolderEditedAt({
				projectRoute: project.main_route,
				folderPath: row.folder_path,
				offsetMs: RECENCY_IGNORE_OFFSET_MS,
			});
			await dbTasks.ignoreRecency({
				id: row.id,
				createdAt: row.created_at - RECENCY_IGNORE_OFFSET_MS,
				updatedAt: (row.updated_at ?? row.created_at) - RECENCY_IGNORE_OFFSET_MS,
			});
		});
		await publishTaskEvent(row.id, row.project_id, "updated");

		const updated = await dbTasks.getById(row.id);
		return updated ? mapTaskWithDisplay(updated) : null;
	}),

	moveToProject: protectedProcedure.input(TaskMoveToProjectSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");
		if (row.project_id === input.targetProjectId) return mapTaskWithDisplay(row);

		const [updated] = await relinkTasks({
			intents: [
				{
					taskId: row.id,
					targetProjectId: input.targetProjectId,
					targetGroupId: null,
				},
			],
		});

		await publishTaskEvent(row.id, row.project_id, "deleted");
		await publishTaskEvent(row.id, input.targetProjectId, "created");
		restartTasksWatcher();

		return updated ? mapTaskWithDisplay(updated) : null;
	}),

	moveToFeature: protectedProcedure.input(TaskMoveToFeatureSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");
		if (row.group_id === input.groupId) return mapTaskWithDisplay(row);

		const [updated] = await relinkTasks({
			intents: [
				{
					taskId: row.id,
					targetProjectId: row.project_id,
					targetGroupId: input.groupId,
				},
			],
		});

		if (updated) {
			await publishTaskEvent(updated.id, updated.project_id, "updated");
		}

		return updated ? mapTaskWithDisplay(updated) : null;
	}),

	reorder: protectedProcedure.input(TaskReorderSchema).handler(async ({ input }) => {
		const rows = await Promise.all(input.orderedIds.map((id) => dbTasks.getById(id)));
		if (rows.some((row) => !row)) throw new Error("Uma tarefa da ordenação não foi encontrada");
		const tasks = rows.filter((row) => row !== undefined);
		const targetGroup = input.groupId ? await dbTaskGroups.getById(input.groupId) : null;
		const projectIds = new Set(tasks.map((task) => task.project_id));
		if (projectIds.size !== 1) throw new Error("A ordenação mistura tarefas de projetos distintos");
		const targetProjectId = targetGroup?.project_id || tasks[0].project_id;

		await relinkTasks({
			intents: tasks.map((task, displayOrder) => ({
				taskId: task.id,
				targetProjectId,
				targetGroupId: input.groupId,
				displayOrder,
			})),
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

		await withTaskStorageMutation(row, (project) =>
			writeTaskFile({
				projectRoute: project.main_route,
				folderPath: row.folder_path,
				name: input.name,
				content: input.content,
			}),
		);

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, name: input.name };
	}),

	setFileDate: protectedProcedure.input(TaskSetFileDateSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		await withTaskStorageMutation(row, (project) =>
			setTaskFileEditedAt({
				projectRoute: project.main_route,
				folderPath: row.folder_path,
				name: input.name,
				editedAt: input.editedAt,
			}),
		);

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, name: input.name, editedAt: input.editedAt };
	}),

	renameFile: protectedProcedure.input(TaskRenameFileSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		// Renomear não muda o tipo do arquivo: a extensão de newName tem de casar com a de oldName.
		const extOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();
		if (extOf(input.oldName) !== extOf(input.newName)) {
			throw new Error("O novo nome deve manter a mesma extensão do arquivo");
		}

		await withTaskStorageMutation(row, async (project) => {
			await renameTaskFile({
				projectRoute: project.main_route,
				folderPath: row.folder_path,
				oldName: input.oldName,
				newName: input.newName,
			});

			const order = parseTaskFileOrder(row.file_order);
			const at = order.indexOf(input.oldName);
			if (at >= 0) {
				order[at] = input.newName;
				await dbTasks.update({ id: row.id, file_order: JSON.stringify(order) });
			}
		});

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, oldName: input.oldName, newName: input.newName };
	}),

	deleteFile: protectedProcedure.input(TaskDeleteFileSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		await withTaskStorageMutation(row, async (project) => {
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
		});

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, name: input.name };
	}),

	reorderFiles: protectedProcedure.input(TaskReorderFilesSchema).handler(async ({ input }) => {
		const row = await dbTasks.getById(input.id);
		if (!row) throw new Error("Tarefa não encontrada");

		await withTaskStorageMutation(row, () =>
			dbTasks.update({ id: input.id, file_order: JSON.stringify(input.orderedNames) }),
		);

		await publishTaskEvent(row.id, row.project_id, "updated");
		return { id: row.id, orderedNames: input.orderedNames };
	}),

	remove: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const { task } = await quarantineTaskStorage(input.id);
		await publishTaskEvent(task.id, task.project_id, "deleted");
		return { id: input.id };
	}),

	restore: protectedProcedure.input(TaskIdSchema).handler(async ({ input }) => {
		const { task } = await restoreTaskStorage(input.id);
		await publishTaskEvent(task.id, task.project_id, "updated");
		return { id: task.id, projectId: task.project_id };
	}),
};
