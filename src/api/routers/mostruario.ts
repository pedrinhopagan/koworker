import { basename } from "node:path";

import { protectedProcedure } from "../auth/context";
import type { tasks } from "../db/connection";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import {
	type AssetFileMeta,
	deleteMostruarioFile,
	listMostruarioFolders,
	moveTaskArtifactsToMostruario,
	readMostruarioFile,
	renameMostruarioFile,
} from "../helpers/koworker-assets";
import { readFirstMarkdownContent, resolveDisplayTitle } from "../helpers/task-folder";
import { restartTasksWatcher } from "../helpers/tasks-watcher";
import { PubSub } from "../pubsub";
import {
	MostruarioDeleteSchema,
	MostruarioListSchema,
	MostruarioMoveFromTaskSchema,
	MostruarioReadFileSchema,
	MostruarioRenameSchema,
} from "../schemas";

// Uma tarefa do mostruário: os artefatos de `mostruario/<taskFolder>/`, com o título e o id da
// tarefa resolvidos pelo id curto (taskFolder) — é isso que liga o mostruário de volta à tarefa.
// taskId é null quando a tarefa foi apagada mas os artefatos ficaram; aí o título cai no id curto.
type MostruarioEntry = {
	projectId: string;
	projectName: string;
	taskFolder: string;
	taskId: string | null;
	title: string;
	lastEditedAt: number;
	files: AssetFileMeta[];
};

async function resolveTaskTitle(
	projectRoute: string,
	task: tasks | null,
	fallback: string,
): Promise<string> {
	if (!task) return fallback;

	const title = task.title?.trim();
	if (title) return title;

	const firstContent = await readFirstMarkdownContent({
		projectRoute,
		folderPath: task.folder_path,
	});
	return resolveDisplayTitle({ firstContent }).title;
}

async function readProjectMostruario(project: {
	id: string;
	name: string;
	main_route: string;
}): Promise<MostruarioEntry[]> {
	const folders = await listMostruarioFolders(project.main_route);
	if (folders.length === 0) return [];

	const projectTasks = await dbTasks.listByProject({ projectId: project.id });
	const taskByFolder = new Map(projectTasks.map((task) => [basename(task.folder_path), task]));

	return Promise.all(
		folders.map(async (folder) => {
			const task = taskByFolder.get(folder.taskFolder) ?? null;
			return {
				projectId: project.id,
				projectName: project.name,
				taskFolder: folder.taskFolder,
				taskId: task?.id ?? null,
				title: await resolveTaskTitle(project.main_route, task, folder.taskFolder),
				lastEditedAt: folder.files.reduce((max, file) => Math.max(max, file.mtime), 0),
				files: folder.files,
			};
		}),
	);
}

export const mostruarioRouter = {
	list: protectedProcedure.input(MostruarioListSchema).handler(async ({ input }) => {
		if (input.projectId) {
			const project = await dbProjects.getById(input.projectId);
			if (!project) return { entries: [] as MostruarioEntry[] };

			return { entries: await readProjectMostruario(project) };
		}

		const projects = await dbProjects.getAll();
		const parts = await Promise.all(projects.map(readProjectMostruario));

		return { entries: parts.flat() };
	}),

	readFile: protectedProcedure.input(MostruarioReadFileSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const file = await readMostruarioFile({
			projectRoute: project.main_route,
			taskFolder: input.taskFolder,
			name: input.name,
		});
		if (!file) throw new Error("Arquivo não encontrado");

		return file;
	}),

	// Move os artefatos de uma tarefa pra `mostruario/<id>/`. Resolve o projeto pela própria tarefa,
	// então o chamador (a página da tarefa) só precisa do taskId.
	moveFromTask: protectedProcedure
		.input(MostruarioMoveFromTaskSchema)
		.handler(async ({ input }) => {
			const task = await dbTasks.getById(input.taskId);
			if (!task) throw new Error("Tarefa não encontrada");

			const project = await dbProjects.getById(task.project_id);
			if (!project) throw new Error("Projeto não encontrado");

			const { moved } = await moveTaskArtifactsToMostruario({
				projectRoute: project.main_route,
				taskFolderPath: task.folder_path,
				names: input.names,
			});

			if (moved.length > 0) {
				await PubSub.publish("tasks", project.id, {
					taskId: task.id,
					projectId: project.id,
					action: "updated",
					source: "api",
				});
				await PubSub.publish("tasks", "global", {
					taskId: task.id,
					projectId: project.id,
					action: "updated",
					source: "api",
				});
				restartTasksWatcher();
			}

			return { taskId: task.id, taskFolder: basename(task.folder_path), moved };
		}),

	deleteFile: protectedProcedure.input(MostruarioDeleteSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await deleteMostruarioFile({
			projectRoute: project.main_route,
			taskFolder: input.taskFolder,
			name: input.name,
		});

		return { taskFolder: input.taskFolder, name: input.name };
	}),

	renameFile: protectedProcedure.input(MostruarioRenameSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await renameMostruarioFile({
			projectRoute: project.main_route,
			taskFolder: input.taskFolder,
			oldName: input.oldName,
			newName: input.newName,
		});

		return { taskFolder: input.taskFolder, oldName: input.oldName, newName: input.newName };
	}),
};
