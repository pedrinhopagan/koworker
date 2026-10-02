import { isAbsolute, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { dbTasks } from "../db/tasks";
import { dbProjects } from "../db/projects";
import { resolveRegisteredFile } from "./registered-file";

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

	if (cwd && /^(\.\.?\/|[^/:]+(\/|$))/.test(withoutPosition)) {
		return resolve(cwd, withoutPosition);
	}

	return null;
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

	const [tasks, projects] = await Promise.all([dbTasks.listLinkTargets(), dbProjects.getAll()]);
	return resolveRegisteredFile({ path, tasks, projects });
}
