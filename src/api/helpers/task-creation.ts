import type { TaskCreateInput } from "../schemas/tasks";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { PubSub } from "../pubsub";
import { buildFolderPath, createTaskFolder, removeTaskFolder } from "./task-folder";
import { restartTasksWatcher } from "./tasks-watcher";

export async function createTask(input: TaskCreateInput) {
	const project = await dbProjects.getById(input.projectId);
	if (!project) {
		throw new Error("Projeto não encontrado");
	}

	const id = crypto.randomUUID();
	const folderPath = buildFolderPath(id);

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
			title: input.title,
			priority_id: input.priorityId,
			category_id: input.categoryId,
			complexity: input.complexity,
			group_id: input.groupId,
		});
	} catch (error) {
		await removeTaskFolder({ projectRoute: project.main_route, folderPath });
		throw error;
	}

	await Promise.all([
		PubSub.publish("tasks", input.projectId, {
			taskId: id,
			projectId: input.projectId,
			action: "created",
			source: "api",
		}),
		PubSub.publish("tasks", "global", {
			taskId: id,
			projectId: input.projectId,
			action: "created",
			source: "api",
		}),
	]);
	restartTasksWatcher();

	return dbTasks.getById(id);
}

export async function rollbackCreatedTask(task: {
	id: string;
	project_id: string;
	folder_path: string;
}) {
	const project = await dbProjects.getById(task.project_id);
	if (project) {
		await removeTaskFolder({ projectRoute: project.main_route, folderPath: task.folder_path });
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
