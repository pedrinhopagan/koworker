import { isAbsolute, join, relative } from "node:path";

import type { dbProjects } from "../db/projects";
import type { dbTasks } from "../db/tasks";

function isInside(path: string, directory: string) {
	const child = relative(directory, path);
	return (
		child === "" ||
		(child !== ".." && !child.startsWith("../") && !child.startsWith("..\\") && !isAbsolute(child))
	);
}

export function resolveRegisteredFile({
	path,
	tasks,
	projects,
}: {
	path: string;
	tasks: Awaited<ReturnType<typeof dbTasks.listLinkTargets>>;
	projects: Pick<Awaited<ReturnType<typeof dbProjects.getAll>>[number], "id" | "main_route">[];
}) {
	const matches = tasks
		.flatMap((task) => {
			const roots = [join(task.main_route, task.folder_path), task.worktree_path].filter(
				(root): root is string => !!root,
			);
			return roots.map((root) => ({ task, root })).filter(({ root }) => isInside(path, root));
		})
		.sort((left, right) => right.root.length - left.root.length);
	const match = matches[0];

	if (match) {
		const file = relative(match.root, path);
		const featureId = match.task.group_id || "sem-feature";
		const taskHref = `/tarefas/${featureId}/${match.task.id}`;
		return {
			kind: "internal" as const,
			projectId: projects.find((project) => project.main_route === match.task.main_route)?.id,
			fileHref:
				match.root === join(match.task.main_route, match.task.folder_path) &&
				/^[^/\\]+\.md$/.test(file)
					? `${taskHref}/${encodeURIComponent(file)}`
					: null,
			href: file && !file.includes("/") ? `${taskHref}/${encodeURIComponent(file)}` : taskHref,
		};
	}

	const project = projects
		.filter((project) => isInside(path, project.main_route))
		.sort((left, right) => right.main_route.length - left.main_route.length)[0];

	return { kind: "file" as const, path, projectId: project?.id };
}
