import { readdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { mapWithConcurrency } from "./concurrency";
import { createFolderCache, invalidateFolderPrefix } from "./folder-cache";
import { isPathInside } from "./path-containment";

export const PROJECT_DOC_NAMES = [
	"CLAUDE.md",
	"AGENTS.md",
	"GEMINI.md",
	"README.md",
	"CONTRIBUTING.md",
] as const;

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", "target", "vendor", "coverage"]);

export const PROJECT_DOC_MAX_DEPTH = 4;
const PROJECT_DOC_SCAN_CONCURRENCY = 8;
const PROJECT_DOCS_TTL_MS = 30_000;

const projectDocsCache = createFolderCache<ProjectDocMeta[]>(PROJECT_DOCS_TTL_MS);

export type ProjectDocMeta = {
	path: string;
	name: string;
	dirLabel: string;
};

export interface ProjectDoc extends ProjectDocMeta {
	content: string;
}

function isRecognizedDoc(path: string) {
	const name = path.split("/").at(-1);
	return !!name && (PROJECT_DOC_NAMES as readonly string[]).includes(name);
}

function resolveProjectDocTarget(projectRoute: string, path: string) {
	if (!isRecognizedDoc(path)) {
		return null;
	}

	const root = resolve(projectRoute);
	const target = resolve(root, path);
	if (!target.startsWith(root + sep)) {
		return null;
	}

	return { root, target };
}

function toDirLabel(path: string) {
	const dir = dirname(path);
	return dir === "." ? "/" : `/${dir}/`;
}

function toProjectDocMeta(root: string, target: string): ProjectDocMeta {
	const path = relative(root, target).split(sep).join("/");
	return { path, name: basename(path), dirLabel: toDirLabel(path) };
}

async function resolveConfinedFile(root: string, target: string) {
	const [canonicalRoot, canonicalTarget] = await Promise.all([
		realpath(root).catch(() => null),
		realpath(target).catch(() => null),
	]);
	if (!canonicalRoot || !canonicalTarget || !isPathInside(canonicalRoot, canonicalTarget)) {
		return null;
	}

	const targetStat = await stat(canonicalTarget).catch(() => null);
	return targetStat?.isFile() ? canonicalTarget : null;
}

async function collectDocs(root: string): Promise<string[]> {
	const matches: string[] = [];
	let level = [root];

	for (let depth = 0; depth <= PROJECT_DOC_MAX_DEPTH && level.length > 0; depth++) {
		const scanned = await mapWithConcurrency(level, PROJECT_DOC_SCAN_CONCURRENCY, async (dir) => {
			const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
			const children: string[] = [];

			for (const entry of entries) {
				if (entry.isDirectory()) {
					if (!entry.name.startsWith(".") && !SKIP_DIRS.has(entry.name)) {
						children.push(join(dir, entry.name));
					}
					continue;
				}

				if (entry.isFile() && (PROJECT_DOC_NAMES as readonly string[]).includes(entry.name)) {
					matches.push(join(dir, entry.name));
				}
			}

			return children;
		});

		level = depth === PROJECT_DOC_MAX_DEPTH ? [] : scanned.flat();
	}

	return matches;
}

export function listProjectDocs(projectRoute: string): Promise<ProjectDocMeta[]> {
	const root = resolve(projectRoute);

	return projectDocsCache.get(root, () => loadProjectDocs(root));
}

async function loadProjectDocs(root: string): Promise<ProjectDocMeta[]> {
	return (await collectDocs(root))
		.map((target) => toProjectDocMeta(root, target))
		.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readProjectDoc(
	projectRoute: string,
	path: string,
): Promise<ProjectDoc | null> {
	const resolved = resolveProjectDocTarget(projectRoute, path);
	if (!resolved) {
		return null;
	}

	const target = await resolveConfinedFile(resolved.root, resolved.target);
	if (!target) {
		return null;
	}

	return {
		...toProjectDocMeta(resolved.root, resolved.target),
		content: await Bun.file(target).text(),
	};
}

export async function writeProjectDoc(params: {
	projectRoute: string;
	path: string;
	content: string;
}): Promise<void> {
	if (!isRecognizedDoc(params.path)) {
		const name = params.path.split("/").at(-1) ?? "";
		throw new Error(`"${name}" não é um documento principal reconhecido`);
	}

	const resolved = resolveProjectDocTarget(params.projectRoute, params.path);
	if (!resolved) {
		throw new Error("Caminho fora do projeto");
	}

	const canonicalRoot = await realpath(resolved.root).catch(() => null);
	const canonicalTarget = await realpath(resolved.target).catch(() => null);
	const canonicalParent = canonicalTarget
		? dirname(canonicalTarget)
		: await realpath(dirname(resolved.target)).catch(() => null);
	if (!canonicalRoot || !canonicalParent || !isPathInside(canonicalRoot, canonicalParent)) {
		throw new Error("Caminho fora do projeto");
	}

	await Bun.write(resolved.target, params.content);
	invalidateFolderPrefix(resolved.root);
}
