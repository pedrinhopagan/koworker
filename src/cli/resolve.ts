import { realpathSync } from "node:fs";

import { normalizeEntityName } from "@/api/db/entity-name";
import { dbProjects } from "@/api/db/projects";
import { dbTaskGroups } from "@/api/db/task-groups";
import { dbTasks } from "@/api/db/tasks";
import { noteSessionTask } from "./kw-terminal";

// Caminho real e normalizado: resolve symlinks (o main_route pode ter sido cadastrado por um
// symlink que o cwd já entrega resolvido) e tira a barra final.
export function canonicalPath(path: string): string {
	const normalized = path.replaceAll("\\", "/").replace(/\/$/, "");
	try {
		return realpathSync(normalized);
	} catch {
		return normalized;
	}
}

export async function resolveProjectByCwd() {
	const cwd = canonicalPath(process.cwd());
	const projects = await dbProjects.getAll();

	return projects.find((project) => canonicalPath(project.main_route) === cwd) ?? null;
}

// Apontar a CLI para uma tarefa é o gesto que diz em qual delas o agente está:
// todo comando de tarefa passa por aqui, então é aqui que a sessão se vincula.
export async function resolveTask(raw: string) {
	const task = await findTask(raw);

	if (task) {
		noteSessionTask({ id: task.id, title: task.title, groupId: task.group_id });
	}

	return task;
}

async function findTask(raw: string) {
	const project = await resolveProjectByCwd();
	if (!project) {
		return null;
	}

	const byId = await dbTasks.getById(raw);
	if (byId?.project_id === project.id) {
		return byId;
	}

	const byStorageKey = await dbTasks.getByStorageKey(raw.toLowerCase());
	if (byStorageKey?.project_id === project.id) {
		return byStorageKey;
	}

	const normalized = raw.replaceAll("\\", "/").replace(/\/$/, "");
	const markerIndex = normalized.indexOf(".koworker/");
	const target =
		markerIndex === -1
			? `.koworker/${normalized}`
			: normalized.slice(markerIndex).replace(/^\.\//, "");
	const tasks = await dbTasks.listFolderPathsByProject(project.id);

	return (
		tasks
			.filter((task) => target === task.folder_path || target.startsWith(`${task.folder_path}/`))
			.sort((left, right) => right.folder_path.length - left.folder_path.length)
			.at(0) ?? null
	);
}

export async function resolveTaskGroupId(arg: string, projectId: string) {
	const groups = await dbTaskGroups.listByProject(projectId);
	const byId = groups.find((candidate) => candidate.id === arg);
	if (byId) {
		return byId.id;
	}

	const normalized = normalizeEntityName(arg);
	const matches = groups.filter((candidate) => normalizeEntityName(candidate.name) === normalized);

	if (matches.length === 0) {
		throw new Error(`Feature não encontrada neste projeto: ${arg}`);
	}
	if (matches.length > 1) {
		throw new Error(
			`Feature ambígua neste projeto: ${arg}. Use o id: ${matches.map((group) => group.id).join(", ")}`,
		);
	}

	return matches[0].id;
}

// A CLI é boundary: a cor é texto livre até provar o formato (mesma regra do schema da UI).
// `undefined` (flag ausente) passa direto — só valida o que foi informado.
export function assertHexColor(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
		throw new Error(`Cor inválida: ${value} (esperado #rrggbb, ex.: #3584e4)`);
	}
	return value;
}
