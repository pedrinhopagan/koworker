import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { dbTasks } from "../db/tasks";

const EXTERNAL_PROTOCOL = /^(https?:|mailto:)/i;

function cleanTarget(target: string) {
	return target.trim().replace(/[),.;:!?]+$/, "");
}

function asPath(target: string, cwd?: string) {
	const withoutPosition = target.replace(/:\d+(?::\d+)?$/, "");
	if (withoutPosition.startsWith("file://")) {
		return fileURLToPath(withoutPosition);
	}

	if (isAbsolute(withoutPosition)) {
		return normalize(withoutPosition);
	}

	if (cwd && /^(\.\.?\/|[^/:]+\/)/.test(withoutPosition)) {
		return resolve(cwd, withoutPosition);
	}

	return null;
}

function isInside(path: string, directory: string) {
	const child = relative(directory, path);
	return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

export async function resolveLinkTarget(input: { target: string; cwd?: string }) {
	const target = cleanTarget(input.target);
	if (EXTERNAL_PROTOCOL.test(target)) {
		return { kind: "external" as const, href: target };
	}

	const path = asPath(target, input.cwd);
	if (!path) {
		return { kind: "unsupported" as const, href: null };
	}

	const tasks = await dbTasks.listLinkTargets();
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
			href: file && !file.includes("/") ? `${taskHref}/${encodeURIComponent(file)}` : taskHref,
		};
	}

	return { kind: "file" as const, path };
}
