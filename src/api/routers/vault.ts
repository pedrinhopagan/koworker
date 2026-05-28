import { protectedProcedure } from "../auth/context";
import { dbCategories } from "../db/categories";
import { dbPriorities } from "../db/priorities";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { restartTasksWatcher } from "../helpers/tasks-watcher";
import {
	linkVaultFilesToTask,
	listVaultFiles,
	promoteVaultFile,
	writeVaultFile,
} from "../helpers/vault-folder";
import { PubSub } from "../pubsub";
import {
	TaskPromoteSchema,
	VaultLinkFilesToTaskSchema,
	VaultListSchema,
	VaultWriteFileSchema,
} from "../schemas";

export const vaultRouter = {
	list: protectedProcedure.input(VaultListSchema).handler(async ({ input }) => {
		const project = await dbProjects.getById(input.projectId);
		if (!project) return [];

		return listVaultFiles(project.main_route);
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

		await linkVaultFilesToTask({
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

		return { taskId: task.id, count: input.files.length };
	}),
};
