import { basename } from "node:path";

import { protectedProcedure } from "../auth/context";
import { dbCategories } from "../db/categories";
import { dbPriorities } from "../db/priorities";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { restartTasksWatcher } from "../helpers/tasks-watcher";
import {
	deleteVaultFile,
	linkVaultFilesToTask,
	listVaultFiles,
	listVaultFolders,
	moveFilesToTask,
	promoteVaultFile,
	renameVaultFile,
	unlinkFilesToVault,
	vaultFolderExists,
	vaultFolderPath,
	writeVaultFile,
} from "../helpers/vault-folder";
import { PubSub } from "../pubsub";
import {
	TaskPromoteSchema,
	VaultAdoptFolderSchema,
	VaultDeleteFileSchema,
	VaultLinkFilesToTaskSchema,
	VaultListSchema,
	VaultMoveFilesToTaskSchema,
	VaultMoveFolderFilesToTaskSchema,
	VaultRenameFileSchema,
	VaultUnlinkFilesSchema,
	VaultWriteFileSchema,
} from "../schemas";

export const vaultRouter = {
	list: protectedProcedure.input(VaultListSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) return [];

		return listVaultFiles(project.main_route);
	}),

	// Pastas soltas: dirs em `.koworker/` que não são pasta de nenhuma task viva. As tasks vivas
	// dão os nomes conhecidos (basename do folder_path), o resto é solto.
	listFolders: protectedProcedure.input(VaultListSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) return [];

		const tasks = await dbTasks.listByProject({ projectId: input.projectId });
		const knownFolderNames = new Set(tasks.map((task) => basename(task.folder_path)));

		return listVaultFolders({ projectRoute: project.main_route, knownFolderNames });
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
