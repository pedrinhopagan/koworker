import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { RESERVED_KOWORKER_FOLDERS } from "@/constants/koworker";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { PubSub } from "../pubsub";
import type { TaskSyncCreateInput } from "../schemas/tasks";
import { readFirstMarkdownContent, readTaskFolderMeta, resolveDisplayTitle } from "./task-folder";
import { restartTasksWatcher } from "./tasks-watcher";

const KOWORKER_DIR = ".koworker";

function taskFolderPath(folderName: string) {
	return join(KOWORKER_DIR, folderName);
}

async function listProjectTaskFolders(project: { id: string; name: string; main_route: string }) {
	const entries = await readdir(join(project.main_route, KOWORKER_DIR), {
		withFileTypes: true,
	}).catch(() => []);
	const folders = entries.filter(
		(entry) => entry.isDirectory() && !RESERVED_KOWORKER_FOLDERS.has(entry.name),
	);

	return await Promise.all(
		folders.map(async (folder) => {
			const folderPath = taskFolderPath(folder.name);
			const [meta, firstContent] = await Promise.all([
				readTaskFolderMeta({ projectRoute: project.main_route, folderPath }),
				readFirstMarkdownContent({ projectRoute: project.main_route, folderPath }),
			]);
			const display = resolveDisplayTitle({ firstContent });

			return {
				projectId: project.id,
				projectName: project.name,
				folderName: folder.name,
				folderPath,
				title: display.fromContent ? display.title : folder.name,
				fileCount: meta.fileNames.length + meta.artifactNames.length,
			};
		}),
	);
}

export async function discoverTaskFolders(projectId: string | null) {
	const projects = projectId
		? [await dbProjects.getById(projectId)].filter((project) => project !== null)
		: await dbProjects.getAll();
	const projectIds = projects.map((project) => project.id);

	if (projectIds.length === 0) {
		return [];
	}

	const [folders, knownRows] = await Promise.all([
		Promise.all(projects.map((project) => listProjectTaskFolders(project))),
		dbTasks.listFolderPathsByProjectIds(projectIds),
	]);
	const known = new Set(knownRows.map((row) => `${row.project_id}:${row.folder_path}`));

	return folders
		.flat()
		.filter(
			(folder) => folder.fileCount > 0 && !known.has(`${folder.projectId}:${folder.folderPath}`),
		)
		.sort(
			(a, b) =>
				a.projectName.localeCompare(b.projectName, "pt-BR") ||
				a.folderName.localeCompare(b.folderName, "pt-BR"),
		);
}

export async function createDiscoveredTasks(input: TaskSyncCreateInput) {
	const inputKeys = input.tasks.map((task) => `${task.projectId}:${task.folderName}`);
	if (new Set(inputKeys).size !== inputKeys.length) {
		throw new Error("A mesma pasta foi selecionada mais de uma vez");
	}

	const discovered = await discoverTaskFolders(null);
	const available = new Set(discovered.map((folder) => `${folder.projectId}:${folder.folderName}`));
	const selected = input.tasks.filter((task) =>
		available.has(`${task.projectId}:${task.folderName}`),
	);

	if (selected.length !== input.tasks.length) {
		throw new Error("Algumas pastas não estão mais disponíveis para sincronização");
	}

	const now = Date.now();
	const rows = selected.map((task) => ({
		id: crypto.randomUUID(),
		project_id: task.projectId,
		folder_path: taskFolderPath(task.folderName),
		title: task.title,
		priority_id: task.priorityId,
		category_id: task.categoryId,
		complexity: task.complexity,
		done: task.done ? 1 : 0,
		completed_at: task.done ? now : undefined,
	}));

	await dbTasks.createMany(rows);
	await Promise.all(
		rows.flatMap((row) => [
			PubSub.publish("tasks", row.project_id, {
				taskId: row.id,
				projectId: row.project_id,
				action: "created" as const,
				source: "api" as const,
			}),
			PubSub.publish("tasks", "global", {
				taskId: row.id,
				projectId: row.project_id,
				action: "created" as const,
				source: "api" as const,
			}),
		]),
	);
	restartTasksWatcher();

	return { created: rows.length };
}
