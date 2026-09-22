import { realpath } from "node:fs/promises";

import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";

export async function fileViewRoots() {
	const [projects, tasks] = await Promise.all([dbProjects.getAll(), dbTasks.listLinkTargets()]);
	const roots = new Set(projects.map((project) => project.main_route));
	for (const task of tasks) {
		if (task.worktree_path) {
			roots.add(task.worktree_path);
		}
	}
	return await Promise.all([...roots].map((root) => realpath(root).catch(() => root)));
}
