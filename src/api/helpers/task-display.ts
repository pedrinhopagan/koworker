import { HOME_RECENT_TASK_LIMIT } from "@/constants/tasks";
import type { tasks } from "@/api/db/connection";
import { dbProjects } from "@/api/db/projects";
import { dbTasks } from "@/api/db/tasks";
import type { TaskRecentInput } from "@/api/schemas/tasks";
import { readFirstMarkdownContent, readTaskFolderMeta, resolveDisplayTitle } from "./task-folder";

export const mapTask = (
	row: tasks,
	display: { title: string; fromContent: boolean },
	meta: { fileNames?: string[]; artifactNames?: string[]; lastEditedAt?: number },
) => ({
	id: row.id,
	projectId: row.project_id,
	folderPath: row.folder_path,
	title: row.title ?? undefined,
	displayTitle: display.title,
	titleFromContent: display.fromContent,
	groupId: row.group_id ?? undefined,
	displayOrder: row.display_order,
	done: !!row.done,
	completedAt: row.completed_at ?? undefined,
	createdAt: row.created_at,
	updatedAt: row.updated_at ?? undefined,
	deletedAt: row.deleted_at ?? undefined,
	lastEditedAt: meta.lastEditedAt ?? row.created_at,
	fileNames: meta.fileNames ?? [],
	artifactNames: meta.artifactNames ?? [],
	worktree: mapWorktree(row),
});

function mapWorktree(row: tasks) {
	if (!row.merge_ready_at) {
		return null;
	}
	if (
		!row.worktree_branch ||
		!row.merge_target_branch ||
		!row.worktree_path ||
		!row.worktree_pr_url
	) {
		throw new Error("Metadados de worktree incompletos");
	}

	return {
		readyAt: row.merge_ready_at,
		branch: row.worktree_branch,
		targetBranch: row.merge_target_branch,
		path: row.worktree_path,
		prUrl: row.worktree_pr_url,
	};
}

export async function mapTaskWithDisplay(row: tasks) {
	const project = await dbProjects.getById(row.project_id);
	const meta = project
		? await readTaskFolderMeta({
				projectRoute: project.main_route,
				folderPath: row.folder_path,
			})
		: { fileNames: [] };

	const title = row.title?.trim();
	if (title) {
		return mapTask(row, { title, fromContent: false }, meta);
	}

	const firstContent = project
		? await readFirstMarkdownContent({
				projectRoute: project.main_route,
				folderPath: row.folder_path,
			})
		: undefined;
	return mapTask(row, resolveDisplayTitle({ firstContent }), meta);
}

export async function mapTasks(rows: tasks[]) {
	if (rows.length === 0) {
		return [];
	}
	const projectIds = [...new Set(rows.map((row) => row.project_id))];
	const projects = new Map(
		(await dbProjects.listRootsByIds(projectIds)).map((project) => [project.id, project] as const),
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
		if (title) {
			return mapTask(row, { title, fromContent: false }, meta);
		}
		return mapTask(
			row,
			resolveDisplayTitle({ firstContent: firstContentByTask.get(row.id) }),
			meta,
		);
	});
}

export async function getRecentTasks(input: TaskRecentInput) {
	const tasks = await mapTasks(await dbTasks.listByProject(input));

	return tasks
		.map((task) =>
			Object.assign(task, {
				lastTouchedAt: Math.max(
					task.lastEditedAt,
					task.updatedAt ?? task.createdAt,
					task.completedAt ?? 0,
				),
			}),
		)
		.sort(
			(left, right) => right.lastTouchedAt - left.lastTouchedAt || left.id.localeCompare(right.id),
		)
		.slice(0, HOME_RECENT_TASK_LIMIT);
}
