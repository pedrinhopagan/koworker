import { protectedProcedure } from "../auth/context";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import {
	type AssetFileMeta,
	deleteMediaFile,
	listMediaFiles,
	listTaskMediaFiles,
	readMediaFile,
	readMediaPreview,
	readTaskMediaFile,
	readTaskMediaPreview,
	renameMediaFile,
	saveMediaFile,
} from "../helpers/koworker-assets";
import {
	MediaDeleteSchema,
	MediaListSchema,
	MediaReadFileSchema,
	MediaRenameSchema,
	MediaUploadSchema,
} from "../schemas";
import { mapTasks } from "./tasks";

const MEDIA_TASK_SCAN_BATCH_SIZE = 16;

type MediaEntry = AssetFileMeta & {
	projectId: string;
	projectName: string;
	taskId: string | null;
	taskTitle: string | null;
};

async function readProjectMedia(project: {
	id: string;
	name: string;
	main_route: string;
}): Promise<MediaEntry[]> {
	const tasks = await dbTasks.listByProject({ projectId: project.id });
	const projectFiles = await listMediaFiles(project.main_route);
	const taskFiles: {
		task: (typeof tasks)[number];
		files: AssetFileMeta[];
	}[] = [];

	for (let index = 0; index < tasks.length; index += MEDIA_TASK_SCAN_BATCH_SIZE) {
		taskFiles.push(
			...(await Promise.all(
				tasks.slice(index, index + MEDIA_TASK_SCAN_BATCH_SIZE).map(async (task) => ({
					task,
					files: await listTaskMediaFiles({
						projectRoute: project.main_route,
						folderPath: task.folder_path,
					}),
				})),
			)),
		);
	}

	const entries: MediaEntry[] = projectFiles.map((file) => ({
		name: file.name,
		mime: file.mime,
		size: file.size,
		mtime: file.mtime,
		projectId: project.id,
		projectName: project.name,
		taskId: null,
		taskTitle: null,
	}));

	const tasksWithFiles = taskFiles.filter(({ files }) => files.length > 0);
	const mappedTasks = await mapTasks(tasksWithFiles.map(({ task }) => task));

	for (const [index, { files }] of tasksWithFiles.entries()) {
		const task = mappedTasks[index];
		if (!task) continue;

		for (const file of files) {
			entries.push({
				name: file.name,
				mime: file.mime,
				size: file.size,
				mtime: file.mtime,
				projectId: project.id,
				projectName: project.name,
				taskId: task.id,
				taskTitle: task.displayTitle,
			});
		}
	}

	return entries.sort((a, b) => b.mtime - a.mtime);
}

export const mediaRouter = {
	// Com projectId, lista a mídia de um projeto; sem ele ("Todos"), agrega todos marcando a origem.
	list: protectedProcedure.input(MediaListSchema).handler(async ({ input }) => {
		if (input.projectId) {
			const project = await dbProjects.getById(input.projectId);
			if (!project) return { entries: [] as MediaEntry[] };

			return { entries: await readProjectMedia(project) };
		}

		const projects = await dbProjects.getAll();
		const parts: MediaEntry[][] = [];
		for (const project of projects) {
			parts.push(await readProjectMedia(project));
		}

		return { entries: parts.flat() };
	}),

	// Bytes de um arquivo (Blob no front). O projectId vem explícito da entry clicada, não do foco
	// global — abrir um arquivo não pode depender de qual projeto está focado no momento.
	readFile: protectedProcedure.input(MediaReadFileSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const task = input.taskId ? await dbTasks.getById(input.taskId) : null;
		if (input.taskId && (!task || task.project_id !== project.id)) {
			throw new Error("Tarefa não encontrada");
		}

		const file = task
			? await readTaskMediaFile({
					projectRoute: project.main_route,
					folderPath: task.folder_path,
					name: input.name,
				})
			: await readMediaFile({ projectRoute: project.main_route, name: input.name });
		if (!file) throw new Error("Arquivo não encontrado");

		return file;
	}),

	readPreview: protectedProcedure.input(MediaReadFileSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const task = input.taskId ? await dbTasks.getById(input.taskId) : null;
		if (input.taskId && (!task || task.project_id !== project.id)) {
			throw new Error("Tarefa não encontrada");
		}

		const file = task
			? await readTaskMediaPreview({
					projectRoute: project.main_route,
					folderPath: task.folder_path,
					name: input.name,
				})
			: await readMediaPreview({ projectRoute: project.main_route, name: input.name });
		if (!file) throw new Error("Arquivo não encontrado");

		return file;
	}),

	// Imagem colada no prompt bar: entra em `.koworker/medias/` com nome gerado e volta a meta
	// confirmada pelo disco — é com esse nome que o front monta o placeholder e a listagem de /media.
	uploadFile: protectedProcedure.input(MediaUploadSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		return saveMediaFile({ projectRoute: project.main_route, file: input.file });
	}),

	deleteFile: protectedProcedure.input(MediaDeleteSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await deleteMediaFile({ projectRoute: project.main_route, name: input.name });

		return { name: input.name };
	}),

	renameFile: protectedProcedure.input(MediaRenameSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await renameMediaFile({
			projectRoute: project.main_route,
			oldName: input.oldName,
			newName: input.newName,
		});

		return { oldName: input.oldName, newName: input.newName };
	}),
};
