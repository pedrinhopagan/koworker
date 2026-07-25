import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { createFolderCache } from "./folder-cache";
import { isPathInside } from "./path-containment";

export const TASK_STORAGE_LAYOUT_V1 = 1;
export const TASK_STORAGE_LAYOUT_V2 = 2;
export const TASK_STORAGE_NAMESPACE = "tasks";
export const TASK_STORAGE_NO_FEATURE = "_sem-feature";

const KOWORKER_DIR = ".koworker";
const STORAGE_SLUG_MAX_LENGTH = 48;
const STORAGE_KEY_LENGTHS = [8, 12, 16, 20, 24, 28, 32] as const;

function storageIdentityHex(id: string) {
	const hex = id.replaceAll("-", "").toLowerCase();

	if (!/^[0-9a-f]{32}$/.test(hex)) {
		throw new Error("Identificador de storage inválido");
	}

	return hex;
}

function assertRelativeKoworkerPath(folderPath: string) {
	if (isAbsolute(folderPath) || folderPath.includes("\\")) {
		throw new Error("Caminho de tarefa inválido");
	}

	const segments = folderPath.split("/");
	if (
		segments.length < 2 ||
		segments[0] !== KOWORKER_DIR ||
		segments.some((segment) => !segment || segment === "." || segment === "..")
	) {
		throw new Error("Caminho de tarefa inválido");
	}

	return segments;
}

function assertFileName(name: string) {
	if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
		throw new Error("Nome de arquivo inválido");
	}
}

const KOWORKER_ROOT_TTL_MS = 30_000;

const koworkerRootCache = createFolderCache<string | null>(KOWORKER_ROOT_TTL_MS);

async function resolveKoworkerRoot(projectRoute: string) {
	const cached = await koworkerRootCache.getResolved(projectRoute, async () => {
		const root = await loadKoworkerRoot(projectRoute).catch(() => null);
		return root ? { value: root, path: root } : { value: null, path: null };
	});
	if (!cached) {
		return await loadKoworkerRoot(projectRoute);
	}

	return cached;
}

async function loadKoworkerRoot(projectRoute: string) {
	const projectRoot = await realpath(projectRoute).catch(() => null);
	if (!projectRoot) {
		throw new Error("Raiz do projeto não encontrada");
	}

	const koworkerPath = join(projectRoot, KOWORKER_DIR);
	const koworkerStats = await lstat(koworkerPath).catch(() => null);
	if (!koworkerStats || koworkerStats.isSymbolicLink() || !koworkerStats.isDirectory()) {
		throw new Error("Diretório .koworker inválido");
	}

	const koworkerRoot = await realpath(koworkerPath);
	if (!isPathInside(projectRoot, koworkerRoot)) {
		throw new Error("Diretório .koworker fora do projeto");
	}

	return koworkerRoot;
}

export function normalizeStorageSlug(
	value: string | null | undefined,
	fallback: "feature" | "tarefa",
) {
	const slug = value
		?.normalize("NFKD")
		.replaceAll(/\p{M}/gu, "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.slice(0, STORAGE_SLUG_MAX_LENGTH)
		.replaceAll(/-+$/g, "");

	return slug || fallback;
}

export function allocateStorageKey(input: { id: string; usedKeys: ReadonlySet<string> }) {
	const hex = storageIdentityHex(input.id);

	for (const length of STORAGE_KEY_LENGTHS) {
		const candidate = hex.slice(0, length);
		if (!input.usedKeys.has(candidate)) {
			return candidate;
		}
	}

	throw new Error("Não foi possível alocar uma chave de storage única");
}

export function storageFolderSegment(slug: string, storageKey: string) {
	if (!STORAGE_KEY_LENGTHS.includes(storageKey.length as (typeof STORAGE_KEY_LENGTHS)[number])) {
		throw new Error("Chave de storage inválida");
	}

	if (!/^[0-9a-f]+$/.test(storageKey)) {
		throw new Error("Chave de storage inválida");
	}

	return `${slug}--${storageKey}`;
}

export function extractStorageKey(segment: string) {
	const match = segment.match(/--([0-9a-f]{8}(?:[0-9a-f]{4}){0,6})$/);

	return match?.[1];
}

export function buildExpectedTaskFolderPath(input: {
	layoutVersion: number;
	taskId: string;
	taskStorageKey: string;
	taskStorageSlug: string;
	featureStorageKey?: string;
	featureStorageSlug?: string;
}) {
	if (input.layoutVersion === TASK_STORAGE_LAYOUT_V1) {
		storageIdentityHex(input.taskId);

		return join(KOWORKER_DIR, input.taskStorageKey);
	}

	if (input.layoutVersion !== TASK_STORAGE_LAYOUT_V2) {
		throw new Error("Versão de layout de tarefas desconhecida");
	}

	const featureSegment =
		input.featureStorageKey && input.featureStorageSlug
			? storageFolderSegment(input.featureStorageSlug, input.featureStorageKey)
			: TASK_STORAGE_NO_FEATURE;

	return join(
		KOWORKER_DIR,
		TASK_STORAGE_NAMESPACE,
		featureSegment,
		storageFolderSegment(input.taskStorageSlug, input.taskStorageKey),
	);
}

export async function resolveExistingTaskFolder(input: {
	projectRoute: string;
	folderPath: string;
}) {
	const segments = assertRelativeKoworkerPath(input.folderPath);
	const koworkerRoot = await resolveKoworkerRoot(input.projectRoute);
	let current = koworkerRoot;

	for (const segment of segments.slice(1)) {
		current = join(current, segment);
		const stats = await lstat(current).catch(() => null);
		if (!stats || stats.isSymbolicLink()) {
			throw new Error("Pasta da tarefa ausente ou insegura");
		}
	}

	const target = await realpath(current);
	if (!isPathInside(koworkerRoot, target)) {
		throw new Error("Pasta da tarefa fora de .koworker");
	}
	if (!(await lstat(target)).isDirectory()) {
		throw new Error("Pasta da tarefa inválida");
	}

	return target;
}

export async function resolveTaskFolderDestination(input: {
	projectRoute: string;
	folderPath: string;
}) {
	const segments = assertRelativeKoworkerPath(input.folderPath);
	const koworkerRoot = await resolveKoworkerRoot(input.projectRoute);
	const target = resolve(koworkerRoot, ...segments.slice(1));

	if (!isPathInside(koworkerRoot, target) || relative(koworkerRoot, target).startsWith("..")) {
		throw new Error("Destino da tarefa fora de .koworker");
	}

	let current = koworkerRoot;
	for (const segment of segments.slice(1)) {
		current = join(current, segment);
		const stats = await lstat(current).catch(() => null);
		if (!stats) {
			break;
		}
		if (stats.isSymbolicLink()) {
			throw new Error("Destino da tarefa atravessa link simbólico");
		}
	}

	return target;
}

export async function resolveExistingTaskFile(input: {
	projectRoute: string;
	folderPath: string;
	name: string;
}) {
	assertFileName(input.name);
	const folder = await resolveExistingTaskFolder(input);
	const path = join(folder, input.name);
	const stats = await lstat(path).catch(() => null);
	if (!stats || stats.isSymbolicLink() || !stats.isFile()) {
		throw new Error("Arquivo da tarefa ausente ou inseguro");
	}

	const target = await realpath(path);
	if (!isPathInside(folder, target)) {
		throw new Error("Arquivo fora da pasta da tarefa");
	}

	return target;
}

export async function resolveTaskFileDestination(input: {
	projectRoute: string;
	folderPath: string;
	name: string;
}) {
	assertFileName(input.name);
	const folder = await resolveExistingTaskFolder(input);
	const target = join(folder, input.name);
	const stats = await lstat(target).catch(() => null);
	if (stats?.isSymbolicLink()) {
		throw new Error("Arquivo da tarefa aponta para link simbólico");
	}

	return target;
}
