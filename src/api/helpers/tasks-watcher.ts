import { existsSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import chokidar from "chokidar";
import { IMAGE_MIME_BY_EXT } from "@/constants/koworker";
import { dbProjects } from "../db/projects";
import { PubSub } from "../pubsub";
import { invalidateFolderPrefix } from "./folder-cache";
import { invalidateMediaFilesCache } from "./koworker-assets";

const KOWORKER_DIR = ".koworker";
const DEBOUNCE_MS = 300;

let watcher: chokidar.FSWatcher | null = null;
let rootToProject = new Map<string, string>();
let pendingProjects = new Set<string>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function projectIdForPath(path: string): string | null {
	for (const [root, projectId] of rootToProject) {
		if (path === root || path.startsWith(root + sep)) return projectId;
	}
	return null;
}

function flushPending() {
	const projectIds = [...pendingProjects];
	pendingProjects.clear();
	debounceTimer = null;

	for (const projectId of projectIds) {
		void PubSub.publish("tasks", projectId, { projectId, action: "updated", source: "fs" });
		void PubSub.publish("tasks", "global", { projectId, action: "updated", source: "fs" });
	}
}

function handleFsEvent(path: string) {
	const projectId = projectIdForPath(path);
	if (!projectId) return;

	// A pasta do arquivo alterado é a chave dos caches de metadados (task e vault). Invalidar por
	// esse prefixo derruba só as entradas afetadas, mantendo o resto do projeto em cache.
	invalidateFolderPrefix(dirname(path));
	const dot = path.lastIndexOf(".");
	if (dot >= 0 && IMAGE_MIME_BY_EXT[path.slice(dot).toLowerCase()]) {
		invalidateMediaFilesCache(dirname(path));
	}

	pendingProjects.add(projectId);
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(flushPending, DEBOUNCE_MS);
}

async function buildRoots(): Promise<Map<string, string>> {
	const projects = await dbProjects.getAll();
	const map = new Map<string, string>();

	for (const project of projects) {
		const root = join(project.main_route, KOWORKER_DIR);
		if (existsSync(root)) {
			map.set(root, project.id);
		}
	}

	return map;
}

export async function stopTasksWatcher(): Promise<void> {
	if (debounceTimer) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}
	pendingProjects.clear();

	if (watcher) {
		await watcher.close();
		watcher = null;
	}
}

// Observa `<main_route>/.koworker/` de cada projeto que já tem a pasta. Evento de FS
// (escrita do agente, novo arquivo, etc.) → publica no canal `tasks` → WS → invalida
// a query no front. Projetos sem `.koworker/` ainda entram no próximo restart.
export async function startTasksWatcher(): Promise<void> {
	await stopTasksWatcher();

	rootToProject = await buildRoots();
	const roots = [...rootToProject.keys()];
	if (roots.length === 0) return;

	watcher = chokidar.watch(roots, {
		ignoreInitial: true,
		awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
	});

	watcher.on("all", (_event, path) => handleFsEvent(path));
}

export function restartTasksWatcher(): void {
	void startTasksWatcher();
}
