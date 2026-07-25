import { existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import chokidar from "chokidar";
import { IMAGE_MIME_BY_EXT } from "@/constants/koworker";
import { dbProjects } from "../db/projects";
import { PubSub } from "../pubsub";
import { invalidateFolderPrefix } from "./folder-cache";
import { invalidateMediaFilesCache } from "./koworker-assets";

const KOWORKER_DIR = ".koworker";
const DEBOUNCE_MS = 300;

// A UI lê só o conteúdo direto da pasta de cada tarefa (.md + artefatos) e as imagens de `medias/`.
// Observar o resto de `.koworker/` custa caro e não muda nada na tela: `.backups`/`.staging` são
// escritos pelo próprio coordinator (cada reconciliação viraria uma tempestade de eventos) e
// `node_modules`/`assets` dentro de uma tarefa chegam a dezenas de milhares de arquivos — foi o que
// saturou o executor (41k descritores abertos e o event loop travado, derrubando o PWA inteiro).
const WATCHED_ROOT_ENTRIES = new Set(["tasks", "medias"]);
const IGNORED_SEGMENTS = new Set([
	"node_modules",
	".git",
	"assets",
	"scratchpad",
	"dist",
	"build",
	"target",
	"coverage",
	"__pycache__",
	".venv",
	".cache",
	".next",
	".turbo",
]);
// tasks/<feature>/<tarefa>/<v1|v2>/<arquivo>
const WATCH_DEPTH = 4;

let watcher: chokidar.FSWatcher | null = null;
let rootToProject = new Map<string, string>();
let pendingProjects = new Set<string>();
const suppressedProjects = new Set<string>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lifecycle: Promise<void> = Promise.resolve();

function projectIdForPath(path: string): string | null {
	for (const [root, projectId] of rootToProject) {
		if (path === root || path.startsWith(root + sep)) return projectId;
	}
	return null;
}

export function isIgnoredWatchPath(root: string, path: string): boolean {
	if (path === root) {
		return false;
	}

	const segments = relative(root, path).split(sep);
	if (!WATCHED_ROOT_ENTRIES.has(segments[0] ?? "")) {
		return true;
	}

	return segments.some((segment) => IGNORED_SEGMENTS.has(segment));
}

function flushPending() {
	debounceTimer = null;

	for (const projectId of pendingProjects) {
		if (suppressedProjects.has(projectId)) {
			continue;
		}

		pendingProjects.delete(projectId);
		void PubSub.publish("tasks", projectId, { projectId, action: "updated", source: "fs" });
		void PubSub.publish("tasks", "global", { projectId, action: "updated", source: "fs" });
	}
}

function handleFsEvent(path: string) {
	const projectId = projectIdForPath(path);
	if (!projectId) return;
	if (suppressedProjects.has(projectId)) {
		pendingProjects.add(projectId);
		return;
	}

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

export function suppressTaskWatcher(projectId: string) {
	suppressedProjects.add(projectId);
}

export function releaseTaskWatcher(projectId: string) {
	suppressedProjects.delete(projectId);
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

function sameRoots(next: Map<string, string>): boolean {
	if (next.size !== rootToProject.size) {
		return false;
	}

	for (const [root, projectId] of next) {
		if (rootToProject.get(root) !== projectId) {
			return false;
		}
	}

	return true;
}

async function closeWatcher(): Promise<void> {
	if (debounceTimer) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}
	pendingProjects.clear();

	if (watcher) {
		const current = watcher;
		watcher = null;
		await current.close();
	}
}

async function openWatcher(): Promise<void> {
	const roots = await buildRoots();
	if (watcher && sameRoots(roots)) {
		return;
	}

	await closeWatcher();
	rootToProject = roots;
	if (roots.size === 0) {
		return;
	}

	const created = chokidar.watch([...roots.keys()], {
		ignoreInitial: true,
		depth: WATCH_DEPTH,
		ignored: (path: string) => {
			for (const root of roots.keys()) {
				if (path === root || path.startsWith(root + sep)) {
					return isIgnoredWatchPath(root, path);
				}
			}

			return false;
		},
		awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
	});

	created.on("all", (_event, path) => handleFsEvent(path));
	watcher = created;
}

// O ciclo de vida é serializado: duas chamadas concorrentes criavam dois chokidar e só o último
// ficava na variável — o anterior seguia observando para sempre, vazando watchers a cada tarefa
// criada. Encadear garante um watcher vivo por vez, mesmo com restarts em rajada.
function enqueue(operation: () => Promise<void>): Promise<void> {
	lifecycle = lifecycle.then(operation, operation);
	return lifecycle;
}

export function stopTasksWatcher(): Promise<void> {
	return enqueue(closeWatcher);
}

// Observa `<main_route>/.koworker/` de cada projeto que já tem a pasta. Evento de FS
// (escrita do agente, novo arquivo, etc.) → publica no canal `tasks` → WS → invalida
// a query no front. Projetos sem `.koworker/` ainda entram no próximo restart.
export function startTasksWatcher(): Promise<void> {
	return enqueue(openWatcher);
}

export function restartTasksWatcher(): void {
	void startTasksWatcher().catch((error) => {
		console.error("[TasksWatcher] Falha ao reiniciar o observador de tarefas:", error);
	});
}
