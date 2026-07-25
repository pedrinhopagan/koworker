import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import { mapWithConcurrency } from "./concurrency";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { readFirstMarkdownContent, resolveDisplayTitle } from "./task-folder";
import {
	buildExpectedTaskFolderPath,
	normalizeStorageSlug,
	resolveExistingTaskFolder,
	resolveTaskFolderDestination,
	TASK_STORAGE_LAYOUT_V1,
	TASK_STORAGE_LAYOUT_V2,
	TASK_STORAGE_NAMESPACE,
} from "./task-storage-path";

const TASK_STORAGE_SCAN_CONCURRENCY = 12;

type TaskStorageEntryFingerprint = {
	path: string;
	size: number;
	hash: string;
};

export type TaskStorageFingerprint = {
	entries: TaskStorageEntryFingerprint[];
	hash: string;
	size: number;
};

export type TaskStorageScanKind =
	| "correct"
	| "flat_migratable"
	| "nested_compatible"
	| "missing_folder"
	| "source_destination_identical"
	| "source_destination_divergent"
	| "feature_missing"
	| "feature_cross_project"
	| "unsafe_path"
	| "soft_deleted_reappeared"
	| "identity_missing"
	| "version_unknown";

export type TaskStorageScanItem = {
	taskId: string;
	title: string;
	kind: TaskStorageScanKind;
	blocked: boolean;
	sourcePath: string;
	destinationPath?: string;
	storageKey?: string;
	storageSlug?: string;
	groupId?: string;
	source?: TaskStorageFingerprint;
	destination?: TaskStorageFingerprint;
};

export type TaskStorageOrphan = {
	folderPath: string;
	fingerprint?: TaskStorageFingerprint;
	unsafe: boolean;
};

function canonicalFingerprint(entries: TaskStorageEntryFingerprint[]) {
	return Bun.hash(JSON.stringify(entries)).toString();
}

export async function fingerprintTaskStorageDirectory(
	root: string,
): Promise<TaskStorageFingerprint> {
	const entries: TaskStorageEntryFingerprint[] = [];

	async function walk(dir: string) {
		const children = await readdir(dir, { withFileTypes: true });
		for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
			const path = join(dir, child.name);
			if (child.isSymbolicLink()) {
				throw new Error("Conteúdo com link simbólico");
			}
			if (child.isDirectory()) {
				await walk(path);
				continue;
			}
			if (!child.isFile()) {
				throw new Error("Conteúdo com tipo de entrada inseguro");
			}

			const bytes = await readFile(path);
			entries.push({
				path: relative(root, path).replaceAll("\\", "/"),
				size: bytes.length,
				hash: Bun.hash(bytes).toString(),
			});
		}
	}

	await walk(root);

	return {
		entries,
		hash: canonicalFingerprint(entries),
		size: entries.reduce((total, entry) => total + entry.size, 0),
	};
}

async function inspectFolder(projectRoute: string, folderPath: string) {
	const target = await resolveTaskFolderDestination({ projectRoute, folderPath });
	const stats = await lstat(target).catch(() => null);
	if (!stats) {
		return { exists: false as const, path: target };
	}

	const path = await resolveExistingTaskFolder({ projectRoute, folderPath });

	return {
		exists: true as const,
		fingerprint: await fingerprintTaskStorageDirectory(path),
		path,
	};
}

async function proposedTaskSlug(input: {
	projectRoute: string;
	folderPath: string;
	storageSlug: string | null;
	title: string | null;
}) {
	if (input.storageSlug) {
		return input.storageSlug;
	}
	if (input.title) {
		return normalizeStorageSlug(input.title, "tarefa");
	}

	const firstContent = await readFirstMarkdownContent({
		projectRoute: input.projectRoute,
		folderPath: input.folderPath,
	});

	return normalizeStorageSlug(
		firstContent ? resolveDisplayTitle({ firstContent }).title : undefined,
		"tarefa",
	);
}

function blockedKind(kind: TaskStorageScanKind) {
	return new Set<TaskStorageScanKind>([
		"missing_folder",
		"source_destination_divergent",
		"feature_missing",
		"feature_cross_project",
		"unsafe_path",
		"soft_deleted_reappeared",
		"identity_missing",
		"version_unknown",
	]).has(kind);
}

async function scanTask(input: {
	project: NonNullable<Awaited<ReturnType<typeof dbProjects.getById>>>;
	task: Awaited<ReturnType<typeof dbTasks.listStorageByProject>>[number];
	duplicatePaths: ReadonlySet<string>;
}): Promise<TaskStorageScanItem> {
	const title = input.task.title || input.task.folder_path;
	if (
		input.project.task_layout_version !== TASK_STORAGE_LAYOUT_V1 &&
		input.project.task_layout_version !== TASK_STORAGE_LAYOUT_V2
	) {
		return {
			taskId: input.task.id,
			title,
			kind: "version_unknown" as const,
			blocked: true,
			sourcePath: input.task.folder_path,
		};
	}
	if (!input.task.storage_key || input.duplicatePaths.has(input.task.folder_path)) {
		return {
			taskId: input.task.id,
			title,
			kind: "identity_missing" as const,
			blocked: true,
			sourcePath: input.task.folder_path,
			storageKey: input.task.storage_key || undefined,
		};
	}
	if (input.task.group_id && !input.task.group_project_id) {
		return {
			taskId: input.task.id,
			title,
			kind: "feature_missing" as const,
			blocked: true,
			sourcePath: input.task.folder_path,
			storageKey: input.task.storage_key,
			groupId: input.task.group_id,
		};
	}
	if (input.task.group_project_id && input.task.group_project_id !== input.project.id) {
		return {
			taskId: input.task.id,
			title,
			kind: "feature_cross_project" as const,
			blocked: true,
			sourcePath: input.task.folder_path,
			storageKey: input.task.storage_key,
			groupId: input.task.group_id || undefined,
		};
	}
	if (input.task.group_id && (!input.task.group_storage_key || !input.task.group_storage_slug)) {
		return {
			taskId: input.task.id,
			title,
			kind: "identity_missing" as const,
			blocked: true,
			sourcePath: input.task.folder_path,
			storageKey: input.task.storage_key,
			groupId: input.task.group_id,
		};
	}

	const storageSlug = await proposedTaskSlug({
		projectRoute: input.project.main_route,
		folderPath: input.task.folder_path,
		storageSlug: input.task.storage_slug || null,
		title: input.task.title || null,
	});
	const destinationPath = buildExpectedTaskFolderPath({
		layoutVersion: TASK_STORAGE_LAYOUT_V2,
		taskId: input.task.id,
		taskStorageKey: input.task.storage_key,
		taskStorageSlug: storageSlug,
		featureStorageKey: input.task.group_storage_key || undefined,
		featureStorageSlug: input.task.group_storage_slug || undefined,
	});

	let source: Awaited<ReturnType<typeof inspectFolder>>;
	let destination: Awaited<ReturnType<typeof inspectFolder>>;
	try {
		if (input.task.folder_path === destinationPath) {
			source = await inspectFolder(input.project.main_route, input.task.folder_path);
			destination = source;
		} else {
			[source, destination] = await Promise.all([
				inspectFolder(input.project.main_route, input.task.folder_path),
				inspectFolder(input.project.main_route, destinationPath),
			]);
		}
	} catch {
		return {
			taskId: input.task.id,
			title,
			kind: "unsafe_path" as const,
			blocked: true,
			sourcePath: input.task.folder_path,
			destinationPath,
			storageKey: input.task.storage_key,
			storageSlug,
			groupId: input.task.group_id || undefined,
		};
	}

	if (input.task.deleted_at) {
		if (source.exists || destination.exists) {
			return {
				taskId: input.task.id,
				title,
				kind: "soft_deleted_reappeared" as const,
				blocked: true,
				sourcePath: input.task.folder_path,
				destinationPath,
				storageKey: input.task.storage_key,
				storageSlug,
				source: source.exists ? source.fingerprint : undefined,
				destination: destination.exists ? destination.fingerprint : undefined,
			};
		}
		return {
			taskId: input.task.id,
			title,
			kind: "correct" as const,
			blocked: false,
			sourcePath: input.task.folder_path,
			destinationPath,
			storageKey: input.task.storage_key,
			storageSlug,
			groupId: input.task.group_id || undefined,
		};
	}
	if (input.task.folder_path === destinationPath) {
		const kind = source.exists ? "correct" : "missing_folder";
		return {
			taskId: input.task.id,
			title,
			kind,
			blocked: blockedKind(kind),
			sourcePath: input.task.folder_path,
			destinationPath,
			storageKey: input.task.storage_key,
			storageSlug,
			groupId: input.task.group_id || undefined,
			source: source.exists ? source.fingerprint : undefined,
		};
	}
	if (!source.exists && !destination.exists) {
		return {
			taskId: input.task.id,
			title,
			kind: "missing_folder" as const,
			blocked: true,
			sourcePath: input.task.folder_path,
			destinationPath,
			storageKey: input.task.storage_key,
			storageSlug,
			groupId: input.task.group_id || undefined,
		};
	}
	if (source.exists && destination.exists) {
		const kind =
			source.fingerprint.hash === destination.fingerprint.hash
				? "source_destination_identical"
				: "source_destination_divergent";

		return {
			taskId: input.task.id,
			title,
			kind,
			blocked: blockedKind(kind),
			sourcePath: input.task.folder_path,
			destinationPath,
			storageKey: input.task.storage_key,
			storageSlug,
			groupId: input.task.group_id || undefined,
			source: source.fingerprint,
			destination: destination.fingerprint,
		};
	}
	if (!source.exists && destination.exists) {
		return {
			taskId: input.task.id,
			title,
			kind: "nested_compatible" as const,
			blocked: false,
			sourcePath: input.task.folder_path,
			destinationPath,
			storageKey: input.task.storage_key,
			storageSlug,
			groupId: input.task.group_id || undefined,
			destination: destination.fingerprint,
		};
	}

	const kind = input.task.folder_path.startsWith(`.koworker/${TASK_STORAGE_NAMESPACE}/`)
		? "nested_compatible"
		: "flat_migratable";

	return {
		taskId: input.task.id,
		title,
		kind,
		blocked: false,
		sourcePath: input.task.folder_path,
		destinationPath,
		storageKey: input.task.storage_key,
		storageSlug,
		groupId: input.task.group_id || undefined,
		source: source.fingerprint,
	};
}

async function listMaterializedFolderPaths(projectRoute: string) {
	const root = join(projectRoute, ".koworker");
	const rootEntries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const flat = rootEntries
		.filter((entry) => entry.isDirectory())
		.filter((entry) => !["tasks", "medias", ".backups", ".staging"].includes(entry.name))
		.map((entry) => join(".koworker", entry.name));
	const taskRoot = join(root, TASK_STORAGE_NAMESPACE);
	const featureEntries = await readdir(taskRoot, { withFileTypes: true }).catch(() => []);
	const nested = (
		await Promise.all(
			featureEntries
				.filter((entry) => entry.isDirectory())
				.map(async (feature) => {
					const tasks = await readdir(join(taskRoot, feature.name), { withFileTypes: true }).catch(
						() => [],
					);

					return tasks
						.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
						.map((entry) => join(".koworker", TASK_STORAGE_NAMESPACE, feature.name, entry.name));
				}),
		)
	).flat();

	return [...flat, ...nested].sort((left, right) => left.localeCompare(right));
}

async function scanOrphans(input: { projectRoute: string; knownPaths: ReadonlySet<string> }) {
	return await mapWithConcurrency(
		(await listMaterializedFolderPaths(input.projectRoute)).filter(
			(folderPath) => !input.knownPaths.has(folderPath),
		),
		TASK_STORAGE_SCAN_CONCURRENCY,
		async (folderPath): Promise<TaskStorageOrphan> => {
			try {
				const folder = await resolveExistingTaskFolder({
					projectRoute: input.projectRoute,
					folderPath,
				});

				return {
					folderPath,
					fingerprint: await fingerprintTaskStorageDirectory(folder),
					unsafe: false,
				};
			} catch {
				return { folderPath, unsafe: true };
			}
		},
	);
}

function fingerprintPlan(input: {
	projectId: string;
	fromLayoutVersion: number;
	toLayoutVersion: number;
	items: TaskStorageScanItem[];
	orphans: TaskStorageOrphan[];
}) {
	return Bun.hash(JSON.stringify(input)).toString();
}

export async function previewTaskStorage(projectId: string) {
	const project = await dbProjects.getById(projectId);
	if (!project) {
		throw new Error("Projeto não encontrado");
	}

	const [tasks, duplicates] = await Promise.all([
		dbTasks.listStorageByProject(projectId),
		dbTasks.listLivePathDuplicates(projectId),
	]);
	const duplicatePaths = new Set(duplicates.map((row) => row.folder_path));
	const items = await mapWithConcurrency(tasks, TASK_STORAGE_SCAN_CONCURRENCY, (task) =>
		scanTask({ project, task, duplicatePaths }),
	);
	items.sort((left, right) => left.taskId.localeCompare(right.taskId));
	const orphans = await scanOrphans({
		projectRoute: project.main_route,
		knownPaths: new Set([
			...tasks.map((task) => task.folder_path),
			...items.flatMap((item) => (item.destinationPath ? [item.destinationPath] : [])),
		]),
	});
	const data = {
		projectId,
		fromLayoutVersion: project.task_layout_version,
		toLayoutVersion: TASK_STORAGE_LAYOUT_V2,
		items,
		orphans,
	};

	return {
		...data,
		planHash: fingerprintPlan(data),
		totals: {
			blocked:
				items.filter((item) => item.blocked).length + orphans.filter((item) => item.unsafe).length,
			correct: items.filter((item) => item.kind === "correct").length,
			orphaned: orphans.length,
			toApply: items.filter((item) => !item.blocked && item.kind !== "correct").length,
		},
	};
}
