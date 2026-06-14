import { basename } from "node:path";

import { protectedProcedure } from "../auth/context";
import type { tasks } from "../db/connection";
import { dbCategories } from "../db/categories";
import { dbPriorities } from "../db/priorities";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { readFirstMarkdownContent, resolveDisplayTitle } from "../helpers/task-folder";
import { restartTasksWatcher } from "../helpers/tasks-watcher";
import {
	deleteVaultFile,
	getVaultFile,
	linkVaultFilesToTask,
	listMdMeta,
	listVaultFiles,
	listVaultFolders,
	moveFilesToTask,
	promoteVaultFile,
	renameVaultFile,
	unlinkFilesToVault,
	type VaultFileMeta,
	vaultFolderExists,
	vaultFolderPath,
	writeVaultFile,
} from "../helpers/vault-folder";
import { PubSub } from "../pubsub";
import {
	TaskPromoteSchema,
	VaultAdoptFolderSchema,
	VaultDeleteFileSchema,
	VaultGetFileSchema,
	VaultLinkFilesToTaskSchema,
	VaultListSchema,
	VaultMoveFilesToTaskSchema,
	VaultMoveFolderFilesToTaskSchema,
	VaultRenameFileSchema,
	VaultUnlinkFilesSchema,
	VaultWriteFileSchema,
} from "../schemas";

type VaultEntry = {
	projectId: string;
	name: string;
	title: string;
	mtime: number;
	origin: "loose" | "folder" | "task";
	groupKey: string | null;
};

type VaultGroup = {
	projectId: string;
	kind: "folder" | "task";
	key: string;
	title: string;
	fileCount: number;
	lastEditedAt: number;
	categoryId?: string;
	priorityId?: string;
	done?: boolean;
};

export const vaultRouter = {
	// Visão geral do vault: todos os `.md` como lista plana (entries, metadata-only) + os grupos
	// (pastas soltas e tasks) que o frontend usa pra agrupar. Cada entry/group carrega o projectId.
	// Com projectId definido, compõe um projeto; sem ele ("Todos"), agrega todos marcando a origem.
	listEntries: protectedProcedure.input(VaultListSchema).handler(async ({ input }) => {
		if (input.projectId) {
			const project = await dbProjects.getById(input.projectId);
			if (!project) return { entries: [], groups: [] };

			return readProjectVault(project);
		}

		const projects = await dbProjects.getAll();
		const parts = await Promise.all(projects.map((project) => readProjectVault(project)));

		return {
			entries: parts.flatMap((part) => part.entries),
			groups: parts.flatMap((part) => part.groups),
		};
	}),

	getFile: protectedProcedure.input(VaultGetFileSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) return null;

		return getVaultFile({ projectRoute: project.main_route, name: input.name });
	}),

	writeFile: protectedProcedure.input(VaultWriteFileSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await writeVaultFile({
			projectRoute: project.main_route,
			name: input.name,
			content: input.content,
		});

		return { name: input.name };
	}),

	renameFile: protectedProcedure.input(VaultRenameFileSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await renameVaultFile({
			projectRoute: project.main_route,
			oldName: input.oldName,
			newName: input.newName,
		});

		return { oldName: input.oldName, newName: input.newName };
	}),

	deleteFile: protectedProcedure.input(VaultDeleteFileSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		await deleteVaultFile({ projectRoute: project.main_route, name: input.name });

		return { name: input.name };
	}),

	promote: protectedProcedure.input(TaskPromoteSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const [priorities, categories] = await Promise.all([
			dbPriorities.getAll(),
			dbCategories.getAll(),
		]);
		const priority = priorities[0];
		const category = categories[0];
		if (!priority || !category) {
			throw new Error("Defina ao menos uma prioridade e uma categoria antes de promover");
		}

		const id = crypto.randomUUID();
		const { folderPath, title } = await promoteVaultFile({
			projectRoute: project.main_route,
			name: input.name,
			taskId: id,
		});

		await dbTasks.create({
			id,
			project_id: project.id,
			folder_path: folderPath,
			title,
			priority_id: priority.id,
			category_id: category.id,
		});

		await PubSub.publish("tasks", project.id, {
			taskId: id,
			projectId: project.id,
			action: "created",
			source: "api",
		});
		await PubSub.publish("tasks", "global", {
			taskId: id,
			projectId: project.id,
			action: "created",
			source: "api",
		});
		restartTasksWatcher();

		return { id, folderPath, title };
	}),

	linkToTask: protectedProcedure.input(VaultLinkFilesToTaskSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const task = await dbTasks.getById(input.taskId);
		if (!task) throw new Error("Tarefa não encontrada");

		const moved = await linkVaultFilesToTask({
			projectRoute: project.main_route,
			taskFolderPath: task.folder_path,
			files: input.files.map((file) => ({
				name: file.name,
				targetName: file.targetName ?? file.name,
			})),
		});

		await PubSub.publish("tasks", project.id, {
			taskId: task.id,
			projectId: project.id,
			action: "updated",
			source: "api",
		});

		return {
			taskId: task.id,
			count: moved.length,
			renamed: moved.filter((file) => file.name !== file.finalName),
		};
	}),

	moveToTask: protectedProcedure.input(VaultMoveFilesToTaskSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const target = await dbTasks.getById(input.targetTaskId);
		if (!target) throw new Error("Tarefa de destino não encontrada");

		const sourceFolders = await resolveTaskFolders(input.files.map((file) => file.taskId));
		if (sourceFolders.has(target.id)) {
			throw new Error("Os arquivos já estão nessa tarefa");
		}

		await moveFilesToTask({
			projectRoute: project.main_route,
			targetFolderPath: target.folder_path,
			files: input.files.map((file) => ({
				sourceFolderPath: getFolder(sourceFolders, file.taskId),
				name: file.name,
			})),
		});

		await publishTasksUpdated(project.id, [target.id, ...sourceFolders.keys()]);

		return { targetTaskId: target.id, count: input.files.length };
	}),

	unlink: protectedProcedure.input(VaultUnlinkFilesSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const sourceFolders = await resolveTaskFolders(input.files.map((file) => file.taskId));

		const moved = await unlinkFilesToVault({
			projectRoute: project.main_route,
			files: input.files.map((file) => ({
				sourceFolderPath: getFolder(sourceFolders, file.taskId),
				name: file.name,
			})),
		});

		await publishTasksUpdated(project.id, [...sourceFolders.keys()]);

		return { count: moved.length, renamed: moved.filter((file) => file.name !== file.finalName) };
	}),

	// Transforma uma pasta solta em tarefa: a task nova passa a apontar para a pasta existente
	// (sem mover arquivo). Sem título — o displayTitle cai no fallback do 1º .md, como qualquer
	// tarefa sem título. Prioridade/categoria pegam a primeira de cada, igual ao promote.
	adoptFolder: protectedProcedure.input(VaultAdoptFolderSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) throw new Error("Projeto não encontrado");

		const folderPath = vaultFolderPath(input.folderName);

		const exists = await vaultFolderExists({
			projectRoute: project.main_route,
			folderName: input.folderName,
		});
		if (!exists) throw new Error("Pasta não encontrada");

		const existing = await dbTasks.getByFolderPath(folderPath);
		if (existing) throw new Error("Essa pasta já pertence a uma tarefa");

		const [priorities, categories] = await Promise.all([
			dbPriorities.getAll(),
			dbCategories.getAll(),
		]);
		const priority = priorities[0];
		const category = categories[0];
		if (!priority || !category) {
			throw new Error("Defina ao menos uma prioridade e uma categoria antes de adotar");
		}

		const id = crypto.randomUUID();
		await dbTasks.create({
			id,
			project_id: project.id,
			folder_path: folderPath,
			priority_id: priority.id,
			category_id: category.id,
		});

		await PubSub.publish("tasks", project.id, {
			taskId: id,
			projectId: project.id,
			action: "created",
			source: "api",
		});
		await PubSub.publish("tasks", "global", {
			taskId: id,
			projectId: project.id,
			action: "created",
			source: "api",
		});
		restartTasksWatcher();

		return { id };
	}),

	// Move `.md` de uma pasta solta para a pasta de uma tarefa existente. Reusa o move entre pastas:
	// a origem é a pasta solta, o destino é a pasta da task.
	moveFolderFilesToTask: protectedProcedure
		.input(VaultMoveFolderFilesToTaskSchema)
		.handler(async ({ input }) => {
			const project = await dbProjects.getById(input.projectId);
			if (!project) throw new Error("Projeto não encontrado");

			const target = await dbTasks.getById(input.targetTaskId);
			if (!target) throw new Error("Tarefa de destino não encontrada");

			const sourceFolderPath = vaultFolderPath(input.folderName);
			await moveFilesToTask({
				projectRoute: project.main_route,
				targetFolderPath: target.folder_path,
				files: input.files.map((name) => ({ sourceFolderPath, name })),
			});

			await publishTasksUpdated(project.id, [target.id]);

			return { targetTaskId: target.id, count: input.files.length };
		}),
};

// Compõe o vault de um projeto: soltos na raiz, pastas soltas e arquivos dentro das tasks num
// único read. Cada entry/group fica marcado com o id do próprio projeto (a agregação "Todos"
// concatena os resultados de vários projetos, então o discriminador precisa vir daqui).
async function readProjectVault(project: { id: string; main_route: string }): Promise<{
	entries: VaultEntry[];
	groups: VaultGroup[];
}> {
	const route = project.main_route;
	const tasks = await dbTasks.listByProject({ projectId: project.id });
	const knownFolderNames = new Set(tasks.map((task) => basename(task.folder_path)));

	const [looseFiles, folders, taskGroups] = await Promise.all([
		listVaultFiles(route),
		listVaultFolders({ projectRoute: route, knownFolderNames }),
		Promise.all(tasks.map((task) => readTaskGroup({ projectRoute: route, task }))),
	]);

	const entries: VaultEntry[] = [
		...looseFiles.map((file) => looseEntry(project.id, file)),
		...folders.flatMap((folder) =>
			folder.files.map((file) => folderEntry(project.id, folder.name, file)),
		),
		...taskGroups.flatMap((group) =>
			group.files.map((file) => taskEntry(project.id, group.task.id, file)),
		),
	];

	const groups: VaultGroup[] = [
		...folders.map((folder) => ({
			projectId: project.id,
			kind: "folder" as const,
			key: folder.name,
			title: folder.name,
			fileCount: folder.files.length,
			lastEditedAt: maxMtime(folder.files),
		})),
		...taskGroups
			.filter((group) => group.files.length > 0)
			.map((group) => ({
				projectId: project.id,
				kind: "task" as const,
				key: group.task.id,
				title: group.displayTitle,
				fileCount: group.files.length,
				lastEditedAt: maxMtime(group.files),
				categoryId: group.task.category_id,
				priorityId: group.task.priority_id,
				done: Boolean(group.task.done),
			})),
	];

	return { entries, groups };
}

function looseEntry(projectId: string, file: VaultFileMeta): VaultEntry {
	return {
		projectId,
		name: file.name,
		title: file.title,
		mtime: file.mtime,
		origin: "loose",
		groupKey: null,
	};
}

function folderEntry(projectId: string, folderName: string, file: VaultFileMeta): VaultEntry {
	return {
		projectId,
		name: file.name,
		title: file.title,
		mtime: file.mtime,
		origin: "folder",
		groupKey: folderName,
	};
}

function taskEntry(projectId: string, taskId: string, file: VaultFileMeta): VaultEntry {
	return {
		projectId,
		name: file.name,
		title: file.title,
		mtime: file.mtime,
		origin: "task",
		groupKey: taskId,
	};
}

function maxMtime(files: VaultFileMeta[]): number {
	return files.reduce((max, file) => Math.max(max, file.mtime), 0);
}

// Arquivos (metadata) + displayTitle de uma task pro vault. O displayTitle segue a mesma regra da
// lista de tasks (título do banco, senão início do 1º .md), não o H1 por arquivo — eles divergem
// em tasks sem título.
async function readTaskGroup(params: {
	projectRoute: string;
	task: tasks;
}): Promise<{ task: tasks; files: VaultFileMeta[]; displayTitle: string }> {
	const title = params.task.title?.trim();
	const files = await listMdMeta({
		projectRoute: params.projectRoute,
		folderPath: params.task.folder_path,
	});

	if (title) return { task: params.task, files, displayTitle: title };

	// Sem título no banco: o displayTitle cai no início do 1º .md, como na lista de tasks.
	const firstContent = await readFirstMarkdownContent({
		projectRoute: params.projectRoute,
		folderPath: params.task.folder_path,
	});

	return { task: params.task, files, displayTitle: resolveDisplayTitle({ firstContent }).title };
}

// Resolve os folder_path das tarefas de origem distintas, falhando se alguma não existir.
async function resolveTaskFolders(taskIds: string[]): Promise<Map<string, string>> {
	const distinct = [...new Set(taskIds)];
	const tasks = await Promise.all(distinct.map((id) => dbTasks.getById(id)));

	const folders = new Map<string, string>();
	tasks.forEach((task, index) => {
		if (!task) throw new Error(`Tarefa ${distinct[index]} não encontrada`);
		folders.set(task.id, task.folder_path);
	});
	return folders;
}

function getFolder(folders: Map<string, string>, taskId: string): string {
	const folder = folders.get(taskId);
	if (!folder) throw new Error(`Tarefa ${taskId} não encontrada`);
	return folder;
}

async function publishTasksUpdated(projectId: string, taskIds: Iterable<string>): Promise<void> {
	await Promise.all(
		[...new Set(taskIds)].map((taskId) =>
			PubSub.publish("tasks", projectId, {
				taskId,
				projectId,
				action: "updated",
				source: "api",
			}),
		),
	);
}
