import type { TaskCreateInput } from "../schemas/tasks";
import { dbProjects } from "../db/projects";
import { dbTaskGroups } from "../db/task-groups";
import { dbTasks } from "../db/tasks";
import { PubSub } from "../pubsub";
import { createTaskFolder, quarantineCreatedTaskFolder } from "./task-folder";
import { withProjectStorageLock } from "./task-storage-coordinator";
import {
	allocateStorageKey,
	buildExpectedTaskFolderPath,
	normalizeStorageSlug,
} from "./task-storage-path";
import { restartTasksWatcher } from "./tasks-watcher";

function taskFeatureStorage(group: Awaited<ReturnType<typeof dbTaskGroups.getById>> | null) {
	if (!group) {
		return {};
	}
	if (!group.storage_key || !group.storage_slug) {
		throw new Error("Feature sem identidade de storage");
	}

	return {
		featureStorageKey: group.storage_key,
		featureStorageSlug: group.storage_slug,
	};
}

export async function createTaskStorage(input: TaskCreateInput) {
	const [project, group] = await Promise.all([
		dbProjects.getById(input.projectId),
		input.groupId ? dbTaskGroups.getById(input.groupId) : null,
	]);
	if (!project) {
		throw new Error("Projeto não encontrado");
	}
	if (input.groupId && (!group || group.project_id !== project.id)) {
		throw new Error("Feature não encontrada neste projeto");
	}
	if (project.task_layout_version !== 1 && project.task_layout_version !== 2) {
		throw new Error("Versão de layout de tarefas desconhecida");
	}

	return withProjectStorageLock(
		{ projectId: project.id, projectRoute: project.main_route },
		async () => {
			const storageKeys = await dbTasks.listStorageKeys();
			const id = crypto.randomUUID();
			const storageKey = allocateStorageKey({
				id,
				usedKeys: new Set(storageKeys.flatMap((row) => (row.storage_key ? [row.storage_key] : []))),
			});
			const storageSlug = normalizeStorageSlug(input.title, "tarefa");
			const folderPath = buildExpectedTaskFolderPath({
				layoutVersion: project.task_layout_version,
				taskId: id,
				taskStorageKey: storageKey,
				taskStorageSlug: storageSlug,
				...taskFeatureStorage(group),
			});

			await createTaskFolder({
				projectRoute: project.main_route,
				folderPath,
				title: input.title,
				seed: input.seed,
			});

			try {
				await dbTasks.create({
					id,
					project_id: input.projectId,
					folder_path: folderPath,
					storage_key: storageKey,
					storage_slug: storageSlug,
					title: input.title,
					priority_id: input.priorityId,
					category_id: input.categoryId,
					complexity: input.complexity,
					group_id: input.groupId,
				});
			} catch (error) {
				await quarantineCreatedTaskFolder({ projectRoute: project.main_route, folderPath });
				throw error;
			}

			return await dbTasks.getById(id);
		},
	);
}

export async function createTask(input: TaskCreateInput) {
	const row = await createTaskStorage(input);
	if (!row) {
		throw new Error("Tarefa não encontrada após a criação");
	}

	await Promise.all([
		PubSub.publish("tasks", input.projectId, {
			taskId: row.id,
			projectId: input.projectId,
			action: "created",
			source: "api",
		}),
		PubSub.publish("tasks", "global", {
			taskId: row.id,
			projectId: input.projectId,
			action: "created",
			source: "api",
		}),
	]);
	restartTasksWatcher();

	return row;
}

export function taskAutoTitleInstruction(taskId: string) {
	return `A tarefa foi criada sem título. Como primeiro passo, defina um título curto (3 a 6 palavras) que resuma o objetivo: rode \`kw-cli task set ${taskId} --title "..."\` e use o mesmo título no H1 do index.md.`;
}

export async function rollbackCreatedTask(task: {
	id: string;
	project_id: string;
	folder_path: string;
}) {
	const project = await dbProjects.getById(task.project_id);
	if (project) {
		await quarantineCreatedTaskFolder({
			projectRoute: project.main_route,
			folderPath: task.folder_path,
		});
	}
	await dbTasks.softDelete(task.id);
	await Promise.all([
		PubSub.publish("tasks", task.project_id, {
			taskId: task.id,
			projectId: task.project_id,
			action: "deleted",
			source: "api",
		}),
		PubSub.publish("tasks", "global", {
			taskId: task.id,
			projectId: task.project_id,
			action: "deleted",
			source: "api",
		}),
	]);
}
