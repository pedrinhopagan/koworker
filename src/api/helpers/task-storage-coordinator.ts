import { cp, lstat, mkdir, open, readFile, rename, stat, statfs } from "node:fs/promises";
import { dirname, join } from "node:path";
import Database from "bun:sqlite";

import { envVariables } from "../config/env";
import { db } from "../db/connection";
import { dbExecutionRuns } from "../db/execution-runs";
import { dbProjects } from "../db/projects";
import { dbTaskGroups } from "../db/task-groups";
import { dbTaskStorageRuns } from "../db/task-storage-runs";
import { dbTasks } from "../db/tasks";
import { TaskStoragePlanSchema } from "../schemas/task-storage";
import {
	fingerprintTaskStorageDirectory,
	previewTaskStorage,
	type TaskStorageFingerprint,
} from "./task-storage-scan";
import { resolveExistingTaskFolder, resolveTaskFolderDestination } from "./task-storage-path";
import { buildExpectedTaskFolderPath, normalizeStorageSlug } from "./task-storage-path";
import { releaseTaskWatcher, suppressTaskWatcher } from "./tasks-watcher";

type TaskStoragePlan = Awaited<ReturnType<typeof previewTaskStorage>>;

function safeProjectId(projectId: string) {
	if (!projectId || projectId.includes("/") || projectId.includes("\\") || projectId === "..") {
		throw new Error("Identificador de projeto inválido para lock");
	}

	return projectId;
}

function lockPath(projectRoute: string, projectId: string) {
	return join(projectRoute, ".koworker", ".staging", "locks", `${safeProjectId(projectId)}.lock`);
}

function processIsAlive(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function acquireProjectLock(input: {
	projectRoute: string;
	projectId: string;
	runId: string;
}) {
	const path = lockPath(input.projectRoute, input.projectId);
	await mkdir(dirname(path), { recursive: true });
	const payload = {
		pid: process.pid,
		runId: input.runId,
		createdAt: Date.now(),
		owner: crypto.randomUUID(),
	};

	async function create() {
		const handle = await open(path, "wx");
		await handle.writeFile(JSON.stringify(payload));
		await handle.close();
	}

	try {
		await create();
	} catch (error: any) {
		if (error?.code !== "EEXIST") {
			throw error;
		}

		const current = await readFile(path, "utf8")
			.then((content) => JSON.parse(content) as { pid?: number })
			.catch((): { pid?: number } => ({}));
		if (current.pid && processIsAlive(current.pid)) {
			throw new Error("Já existe uma reconciliação ativa neste projeto", { cause: error });
		}

		await rename(path, `${path}.abandoned.${crypto.randomUUID()}`);
		await create();
	}

	return {
		owner: payload.owner,
		async release() {
			const current = await readFile(path, "utf8")
				.then((content) => JSON.parse(content) as { owner?: string })
				.catch(() => null);
			if (current?.owner !== payload.owner) {
				throw new Error("O lock da reconciliação mudou de dono");
			}

			await rename(path, `${path}.released.${crypto.randomUUID()}`);
		},
	};
}

export async function assertProjectStorageAvailable(input: {
	projectId: string;
	projectRoute: string;
}) {
	const [activeRun, lock] = await Promise.all([
		dbTaskStorageRuns.getActiveByProject(input.projectId),
		lstat(lockPath(input.projectRoute, input.projectId)).catch(() => null),
	]);
	if (activeRun || lock) {
		throw new Error("O storage de tarefas deste projeto está em reconciliação");
	}
}

export async function withProjectStorageLock<T>(
	input: { projectId: string; projectRoute: string },
	operation: () => Promise<T>,
) {
	const runId = crypto.randomUUID();
	const lock = await acquireProjectLock({
		projectRoute: input.projectRoute,
		projectId: input.projectId,
		runId,
	});
	try {
		const activeRun = await dbTaskStorageRuns.getActiveByProject(input.projectId);
		if (activeRun) {
			throw new Error("O storage de tarefas deste projeto está em reconciliação");
		}
		return await operation();
	} finally {
		await lock.release();
	}
}

function backupFolderPath(projectRoute: string, runId: string, taskId: string) {
	return join(projectRoute, ".koworker", ".backups", "layout-v2", runId, "files", taskId);
}

function stagingFolderPath(projectRoute: string, runId: string, taskId: string) {
	return join(projectRoute, ".koworker", ".staging", runId, taskId);
}

function expectedFingerprint(input: {
	source?: TaskStorageFingerprint;
	destination?: TaskStorageFingerprint;
}) {
	const fingerprint = input.source || input.destination;
	if (!fingerprint) {
		throw new Error("Item do plano sem fingerprint de conteúdo");
	}

	return fingerprint;
}

async function verifyFingerprint(path: string, expected: TaskStorageFingerprint) {
	const actual = await fingerprintTaskStorageDirectory(path);
	if (actual.hash !== expected.hash || actual.size !== expected.size) {
		throw new Error("A verificação de conteúdo da tarefa falhou");
	}

	return actual;
}

async function assertFreeSpace(input: { projectRoute: string; plan: TaskStoragePlan }) {
	const filesystem = await statfs(input.projectRoute);
	const available = Number(filesystem.bavail) * Number(filesystem.bsize);
	const databaseSize = await stat(envVariables.DATABASE_URL)
		.then((entry) => entry.size)
		.catch(() => 0);
	const contentSize = input.plan.items.reduce((total, item) => total + (item.source?.size || 0), 0);
	const required = contentSize * 2 + databaseSize * 2 + 1_048_576;
	if (available < required) {
		throw new Error("Espaço insuficiente para backup e staging da reconciliação");
	}
}

async function snapshotDatabase(path: string) {
	const sqlite = new Database(envVariables.DATABASE_URL);
	try {
		sqlite.query("VACUUM INTO ?").run(path);
	} finally {
		sqlite.close();
	}

	await verifyDatabaseSnapshot(path);
}

function verifyDatabaseSnapshot(path: string) {
	const snapshot = new Database(path, { readonly: true });
	try {
		const result = snapshot.query<{ integrity_check: string }, []>("PRAGMA integrity_check").get();
		if (result?.integrity_check !== "ok") {
			throw new Error("Snapshot SQLite não passou na verificação de integridade");
		}
	} finally {
		snapshot.close();
	}
}

async function verifyRunRecoveryArtifacts(input: {
	projectRoute: string;
	plan: TaskStoragePlan;
	runId: string;
}) {
	const root = join(input.projectRoute, ".koworker", ".backups", "layout-v2", input.runId);
	const manifest = TaskStoragePlanSchema.parse(
		JSON.parse(await readFile(join(root, "manifest.json"), "utf8")),
	);
	if (manifest.planHash !== input.plan.planHash) {
		throw new Error("Manifesto local não corresponde ao journal");
	}
	await verifyDatabaseSnapshot(join(root, "database.sqlite"));
}

async function backUpSources(input: {
	projectRoute: string;
	runId: string;
	plan: TaskStoragePlan;
}) {
	for (const item of input.plan.items) {
		if (item.kind === "correct" || !item.source) {
			continue;
		}

		const source = await resolveExistingTaskFolder({
			projectRoute: input.projectRoute,
			folderPath: item.sourcePath,
		}).catch(() => null);
		const backup = backupFolderPath(input.projectRoute, input.runId, item.taskId);
		const existingBackup = await lstat(backup).catch(() => null);
		if (existingBackup) {
			await verifyFingerprint(backup, item.source);
			if (source) {
				await verifyFingerprint(source, item.source);
				await rename(source, `${backup}.duplicate.${crypto.randomUUID()}`);
			}
			continue;
		}
		if (!source) {
			throw new Error("Origem e backup da tarefa estão ausentes");
		}
		await mkdir(dirname(backup), { recursive: true });
		await rename(source, backup);
		await verifyFingerprint(backup, item.source);
	}
}

async function publishDestinations(input: {
	projectRoute: string;
	runId: string;
	plan: TaskStoragePlan;
}) {
	for (const item of input.plan.items) {
		if (item.kind === "correct") {
			continue;
		}
		if (!item.destinationPath) {
			throw new Error("Item do plano sem destino");
		}
		const existingDestination = await resolveExistingTaskFolder({
			projectRoute: input.projectRoute,
			folderPath: item.destinationPath,
		}).catch(() => null);
		if (existingDestination) {
			await verifyFingerprint(existingDestination, expectedFingerprint(item));
			continue;
		}
		if (item.destination) {
			const destination = await resolveExistingTaskFolder({
				projectRoute: input.projectRoute,
				folderPath: item.destinationPath,
			});
			await verifyFingerprint(destination, expectedFingerprint(item));
			continue;
		}

		const backup = backupFolderPath(input.projectRoute, input.runId, item.taskId);
		const staging = stagingFolderPath(input.projectRoute, input.runId, item.taskId);
		await mkdir(dirname(staging), { recursive: true });
		const existingStaging = await lstat(staging).catch(() => null);
		if (existingStaging) {
			try {
				await verifyFingerprint(staging, expectedFingerprint(item));
			} catch {
				await rename(staging, `${staging}.divergent.${crypto.randomUUID()}`);
			}
		}
		if (!(await lstat(staging).catch(() => null))) {
			await cp(backup, staging, { recursive: true, errorOnExist: true, force: false });
		}
		await verifyFingerprint(staging, expectedFingerprint(item));
		const destination = await resolveTaskFolderDestination({
			projectRoute: input.projectRoute,
			folderPath: item.destinationPath,
		});
		await mkdir(dirname(destination), { recursive: true });
		await rename(staging, destination);
		await verifyFingerprint(destination, expectedFingerprint(item));
	}
}

async function commitDatabase(input: { runId: string; plan: TaskStoragePlan }) {
	await db.transaction().execute(async (trx) => {
		for (const item of input.plan.items) {
			if (item.kind === "correct" && !item.source && !item.destination) {
				continue;
			}
			if (!item.destinationPath || !item.storageSlug) {
				throw new Error("Item do plano sem identidade materializável");
			}

			await trx
				.updateTable("tasks")
				.set({
					folder_path: item.destinationPath,
					storage_slug: item.storageSlug,
					updated_at: Date.now(),
				})
				.where("id", "=", item.taskId)
				.executeTakeFirstOrThrow();
		}

		await trx
			.updateTable("projects")
			.set({ task_layout_version: input.plan.toLayoutVersion, updated_at: Date.now() })
			.where("id", "=", input.plan.projectId)
			.executeTakeFirstOrThrow();
		const run = await trx
			.updateTable("task_storage_runs")
			.set({ status: "committed_db", updated_at: Date.now() })
			.where("id", "=", input.runId)
			.where("status", "=", "applying_fs")
			.returning("id")
			.executeTakeFirst();
		if (!run) {
			throw new Error("O journal não permitiu o commit do banco");
		}
	});
}

async function verifyPublishedPlan(projectRoute: string, plan: TaskStoragePlan) {
	for (const item of plan.items) {
		if (item.kind === "correct" && !item.source && !item.destination) {
			continue;
		}
		if (!item.destinationPath) {
			throw new Error("Item do plano sem destino verificável");
		}
		const destination = await resolveExistingTaskFolder({
			projectRoute,
			folderPath: item.destinationPath,
		});
		await verifyFingerprint(destination, expectedFingerprint(item));
	}
}

async function continueTaskStorageRun(input: {
	project: NonNullable<Awaited<ReturnType<typeof dbProjects.getById>>>;
	plan: TaskStoragePlan;
	runId: string;
}) {
	const run = await dbTaskStorageRuns.getById(input.runId);
	if (!run) {
		throw new Error("Run de storage não encontrado");
	}

	switch (run.status) {
		case "planned": {
			await backUpSources({
				projectRoute: input.project.main_route,
				runId: input.runId,
				plan: input.plan,
			});
			await dbTaskStorageRuns.transition({
				id: input.runId,
				transition: "backUp",
				patch: {
					backup_path: join(
						input.project.main_route,
						".koworker",
						".backups",
						"layout-v2",
						input.runId,
					),
				},
			});
			return await continueTaskStorageRun(input);
		}
		case "backed_up": {
			await dbTaskStorageRuns.transition({ id: input.runId, transition: "startApply" });
			return await continueTaskStorageRun(input);
		}
		case "applying_fs": {
			await publishDestinations({
				projectRoute: input.project.main_route,
				runId: input.runId,
				plan: input.plan,
			});
			await commitDatabase({ runId: input.runId, plan: input.plan });
			return await continueTaskStorageRun(input);
		}
		case "committed_db": {
			await verifyPublishedPlan(input.project.main_route, input.plan);
			await dbTaskStorageRuns.transition({ id: input.runId, transition: "verify" });
			return await continueTaskStorageRun(input);
		}
		case "verified":
			return await dbTaskStorageRuns.transition({ id: input.runId, transition: "complete" });
		case "blocked": {
			await backUpSources({
				projectRoute: input.project.main_route,
				runId: input.runId,
				plan: input.plan,
			});
			await dbTaskStorageRuns.transition({ id: input.runId, transition: "resumeApplying" });
			return await continueTaskStorageRun(input);
		}
		case "completed":
			return run;
		case "rollback_required":
		case "rolled_back":
			throw new Error("O run está no fluxo de rollback");
	}
}

async function blockTaskStorageRun(runId: string, error: unknown) {
	await dbTaskStorageRuns.transition({
		id: runId,
		transition: "block",
		patch: { error: error instanceof Error ? error.message : "Falha desconhecida" },
	});
}

async function applyLocked(input: {
	project: NonNullable<Awaited<ReturnType<typeof dbProjects.getById>>>;
	plan: TaskStoragePlan;
	runId: string;
	lockOwner: string;
}) {
	const activeExecutions = await dbExecutionRuns.listRunningTaskIds(
		input.project.id,
		input.plan.items.map((item) => item.taskId),
	);
	if (activeExecutions.length > 0) {
		throw new Error("Há tarefas do plano com execução ativa");
	}
	await assertFreeSpace({ projectRoute: input.project.main_route, plan: input.plan });

	const backupRoot = join(
		input.project.main_route,
		".koworker",
		".backups",
		"layout-v2",
		input.runId,
	);
	await mkdir(backupRoot, { recursive: true });
	await Bun.write(join(backupRoot, "manifest.json"), JSON.stringify(input.plan, null, 2));
	await snapshotDatabase(join(backupRoot, "database.sqlite"));
	const run = await dbTaskStorageRuns.create({
		id: input.runId,
		project_id: input.project.id,
		plan_hash: input.plan.planHash,
		from_layout_version: input.plan.fromLayoutVersion,
		to_layout_version: input.plan.toLayoutVersion,
		manifest: JSON.stringify(input.plan),
		lock_owner: input.lockOwner,
	});

	try {
		return await continueTaskStorageRun({
			project: input.project,
			plan: input.plan,
			runId: run.id,
		});
	} catch (error) {
		await blockTaskStorageRun(run.id, error);
		throw error;
	}
}

export async function applyTaskStorage(input: {
	projectId: string;
	planHash: string;
	confirmed: true;
}) {
	const project = await dbProjects.getById(input.projectId);
	if (!project) {
		throw new Error("Projeto não encontrado");
	}
	const runId = crypto.randomUUID();
	const lock = await acquireProjectLock({
		projectRoute: project.main_route,
		projectId: project.id,
		runId,
	});
	suppressTaskWatcher(project.id);
	try {
		const plan = await previewTaskStorage(input.projectId);
		if (plan.planHash !== input.planHash) {
			throw new Error("O plano de reconciliação ficou obsoleto");
		}
		if (plan.totals.blocked > 0) {
			throw new Error("O plano possui conflitos bloqueantes");
		}
		if (plan.orphans.length > 0) {
			throw new Error("Importe ou trate as pastas órfãs antes de aplicar o layout");
		}
		const run = await applyLocked({ project, plan, runId, lockOwner: lock.owner });
		if (!run) {
			throw new Error("O journal não confirmou a conclusão da reconciliação");
		}
		return run;
	} finally {
		releaseTaskWatcher(project.id);
		await lock.release();
	}
}

export async function resumeTaskStorage(runId: string) {
	const run = await dbTaskStorageRuns.getById(runId);
	if (!run) {
		throw new Error("Run de storage não encontrado");
	}
	if (run.status === "completed") {
		return run;
	}
	if (run.status === "rolled_back" || run.status === "rollback_required") {
		throw new Error("O run está no fluxo de rollback");
	}
	const project = await dbProjects.getById(run.project_id);
	if (!project) {
		throw new Error("Projeto do run não encontrado");
	}
	const plan = TaskStoragePlanSchema.parse(JSON.parse(run.manifest));
	if (plan.projectId !== project.id || plan.planHash !== run.plan_hash) {
		throw new Error("Manifesto do run não corresponde ao journal");
	}
	await verifyRunRecoveryArtifacts({
		projectRoute: project.main_route,
		plan,
		runId: run.id,
	});

	const lock = await acquireProjectLock({
		projectRoute: project.main_route,
		projectId: project.id,
		runId: run.id,
	});
	const claimed = await dbTaskStorageRuns.claimLock({ id: run.id, lockOwner: lock.owner });
	if (!claimed) {
		await lock.release();
		throw new Error("O run não pode ser retomado neste estado");
	}
	suppressTaskWatcher(project.id);
	try {
		const resumed = await continueTaskStorageRun({ project, plan, runId: run.id });
		if (!resumed) {
			throw new Error("O journal não confirmou a retomada da reconciliação");
		}
		return resumed;
	} catch (error) {
		await blockTaskStorageRun(run.id, error);
		throw error;
	} finally {
		releaseTaskWatcher(project.id);
		await lock.release();
	}
}

async function prepareRollback(input: {
	projectRoute: string;
	plan: TaskStoragePlan;
	runId: string;
}) {
	const restored: { taskId: string; folderPath: string; fingerprint: TaskStorageFingerprint }[] =
		[];

	for (const item of input.plan.items) {
		if (item.kind === "correct") {
			continue;
		}
		if (!item.source && item.destination && item.destinationPath) {
			const destination = await resolveExistingTaskFolder({
				projectRoute: input.projectRoute,
				folderPath: item.destinationPath,
			});
			await verifyFingerprint(destination, item.destination);
			const preservedDestination = join(
				input.projectRoute,
				".koworker",
				".backups",
				"rollback-destinations",
				input.runId,
				item.taskId,
			);
			await mkdir(dirname(preservedDestination), { recursive: true });
			await rename(destination, preservedDestination);
			const restoredDestination = await resolveTaskFolderDestination({
				projectRoute: input.projectRoute,
				folderPath: item.sourcePath,
			});
			await mkdir(dirname(restoredDestination), { recursive: true });
			await cp(preservedDestination, restoredDestination, {
				recursive: true,
				errorOnExist: true,
				force: false,
			});
			await verifyFingerprint(restoredDestination, item.destination);
			restored.push({
				taskId: item.taskId,
				folderPath: item.sourcePath,
				fingerprint: item.destination,
			});
			continue;
		}
		if (!item.source) {
			continue;
		}

		const backup = backupFolderPath(input.projectRoute, input.runId, item.taskId);
		await verifyFingerprint(backup, item.source);
		if (item.destinationPath) {
			const destination = await resolveExistingTaskFolder({
				projectRoute: input.projectRoute,
				folderPath: item.destinationPath,
			}).catch(() => null);
			if (destination) {
				await verifyFingerprint(destination, expectedFingerprint(item));
				const preservedDestination = join(
					input.projectRoute,
					".koworker",
					".backups",
					"rollback-destinations",
					input.runId,
					item.taskId,
				);
				await mkdir(dirname(preservedDestination), { recursive: true });
				await rename(destination, preservedDestination);
			}
		}

		const original = await resolveExistingTaskFolder({
			projectRoute: input.projectRoute,
			folderPath: item.sourcePath,
		}).catch(() => null);
		const folderPath = original
			? join(".koworker", `restored-${item.taskId.slice(0, 8)}--${input.runId.slice(0, 8)}`)
			: item.sourcePath;
		const destination = await resolveTaskFolderDestination({
			projectRoute: input.projectRoute,
			folderPath,
		});
		const staging = join(
			input.projectRoute,
			".koworker",
			".staging",
			input.runId,
			`rollback-${item.taskId}`,
		);
		const existingStaging = await lstat(staging).catch(() => null);
		if (existingStaging) {
			await rename(staging, `${staging}.preserved.${crypto.randomUUID()}`);
		}
		await mkdir(dirname(staging), { recursive: true });
		await cp(backup, staging, { recursive: true, errorOnExist: true, force: false });
		await verifyFingerprint(staging, item.source);
		await mkdir(dirname(destination), { recursive: true });
		await rename(staging, destination);
		await verifyFingerprint(destination, item.source);
		restored.push({ taskId: item.taskId, folderPath, fingerprint: item.source });
	}

	return restored;
}

async function commitRollback(input: {
	plan: TaskStoragePlan;
	restored: { taskId: string; folderPath: string; fingerprint: TaskStorageFingerprint }[];
	runId: string;
}) {
	await db.transaction().execute(async (trx) => {
		for (const item of input.restored) {
			await trx
				.updateTable("tasks")
				.set({ folder_path: item.folderPath, updated_at: Date.now() })
				.where("id", "=", item.taskId)
				.executeTakeFirstOrThrow();
		}

		await trx
			.updateTable("projects")
			.set({ task_layout_version: input.plan.fromLayoutVersion, updated_at: Date.now() })
			.where("id", "=", input.plan.projectId)
			.executeTakeFirstOrThrow();
		const run = await trx
			.updateTable("task_storage_runs")
			.set({ status: "rolled_back", updated_at: Date.now(), completed_at: Date.now() })
			.where("id", "=", input.runId)
			.where("status", "=", "rollback_required")
			.returning("id")
			.executeTakeFirst();
		if (!run) {
			throw new Error("O journal não permitiu o commit do rollback");
		}
	});
}

export async function rollbackTaskStorage(runId: string) {
	const run = await dbTaskStorageRuns.getById(runId);
	if (!run) {
		throw new Error("Run de storage não encontrado");
	}
	const project = await dbProjects.getById(run.project_id);
	if (!project) {
		throw new Error("Projeto do run não encontrado");
	}
	const plan = TaskStoragePlanSchema.parse(JSON.parse(run.manifest));
	if (plan.projectId !== project.id || plan.planHash !== run.plan_hash) {
		throw new Error("Manifesto do run não corresponde ao journal");
	}
	await verifyRunRecoveryArtifacts({
		projectRoute: project.main_route,
		plan,
		runId: run.id,
	});

	const lock = await acquireProjectLock({
		projectRoute: project.main_route,
		projectId: project.id,
		runId: run.id,
	});
	suppressTaskWatcher(project.id);
	try {
		const current = await dbTaskStorageRuns.getById(run.id);
		if (!current) {
			throw new Error("Run de storage não encontrado");
		}
		if (current.status === "planned") {
			await dbTaskStorageRuns.transition({ id: run.id, transition: "block" });
		}
		const rollbackRequired = await dbTaskStorageRuns.transition({
			id: run.id,
			transition: "requireRollback",
		});
		if (!rollbackRequired) {
			throw new Error("O run não pode iniciar rollback neste estado");
		}

		const restored = await prepareRollback({
			projectRoute: project.main_route,
			plan,
			runId: run.id,
		});
		await commitRollback({ plan, restored, runId: run.id });

		const rolledBack = await dbTaskStorageRuns.getById(run.id);
		if (!rolledBack) {
			throw new Error("O journal não confirmou o rollback");
		}
		return rolledBack;
	} finally {
		releaseTaskWatcher(project.id);
		await lock.release();
	}
}

export type TaskRelinkIntent = {
	taskId: string;
	targetProjectId: string;
	targetGroupId: string | null;
	displayOrder?: number;
	categoryId?: string;
	done?: boolean;
	completedAt?: number | null;
	clearMergeMetadata?: boolean;
};

function relinkFeatureStorage(group: Awaited<ReturnType<typeof dbTaskGroups.getById>> | null) {
	if (!group) {
		return {};
	}
	if (!group.storage_key || !group.storage_slug) {
		throw new Error("Feature sem identidade de storage");
	}

	return { featureStorageKey: group.storage_key, featureStorageSlug: group.storage_slug };
}

async function loadRelinkContext(intent: TaskRelinkIntent) {
	const task = await dbTasks.getById(intent.taskId);
	if (!task) {
		throw new Error("Tarefa não encontrada");
	}
	const [sourceProject, targetProject, group] = await Promise.all([
		dbProjects.getById(task.project_id),
		dbProjects.getById(intent.targetProjectId),
		intent.targetGroupId ? dbTaskGroups.getById(intent.targetGroupId) : null,
	]);
	if (!sourceProject || !targetProject) {
		throw new Error("Projeto de origem ou destino não encontrado");
	}
	if (intent.targetGroupId && (!group || group.project_id !== targetProject.id)) {
		throw new Error("Feature não encontrada no projeto de destino");
	}
	if (!task.storage_key) {
		throw new Error("Tarefa sem chave de storage");
	}

	const storageSlug = task.storage_slug || normalizeStorageSlug(task.title, "tarefa");
	const destinationPath = buildExpectedTaskFolderPath({
		layoutVersion: targetProject.task_layout_version,
		taskId: task.id,
		taskStorageKey: task.storage_key,
		taskStorageSlug: storageSlug,
		...relinkFeatureStorage(group),
	});

	return { destinationPath, group, intent, sourceProject, storageSlug, targetProject, task };
}

async function acquireProjectLocks(input: {
	contexts: Awaited<ReturnType<typeof loadRelinkContext>>[];
	runId: string;
}) {
	const projects = new Map<string, { id: string; main_route: string }>();
	for (const context of input.contexts) {
		projects.set(context.sourceProject.id, context.sourceProject);
		projects.set(context.targetProject.id, context.targetProject);
	}
	const ordered = [...projects.values()].sort((left, right) => left.id.localeCompare(right.id));
	const locks: Awaited<ReturnType<typeof acquireProjectLock>>[] = [];

	try {
		for (const project of ordered) {
			const active = await dbTaskStorageRuns.getActiveByProject(project.id);
			if (active) {
				throw new Error("O storage de tarefas deste projeto está em reconciliação");
			}
			locks.push(
				await acquireProjectLock({
					projectRoute: project.main_route,
					projectId: project.id,
					runId: input.runId,
				}),
			);
		}
	} catch (error) {
		for (const lock of locks.toReversed()) {
			await lock.release();
		}
		throw error;
	}

	return {
		projects: ordered,
		async release() {
			for (const lock of locks.toReversed()) {
				await lock.release();
			}
		},
	};
}

async function restoreFailedRelinks(input: {
	moved: {
		backup: string;
		context: Awaited<ReturnType<typeof loadRelinkContext>>;
		fingerprint: TaskStorageFingerprint;
		published: boolean;
	}[];
	runId: string;
}) {
	for (const moved of input.moved.toReversed()) {
		if (moved.published) {
			const destination = await resolveExistingTaskFolder({
				projectRoute: moved.context.targetProject.main_route,
				folderPath: moved.context.destinationPath,
			}).catch(() => null);
			if (destination) {
				const preserved = join(
					moved.context.targetProject.main_route,
					".koworker",
					".backups",
					"relink-failures",
					input.runId,
					moved.context.task.id,
				);
				await mkdir(dirname(preserved), { recursive: true });
				await rename(destination, preserved);
			}
		}

		const source = await resolveExistingTaskFolder({
			projectRoute: moved.context.sourceProject.main_route,
			folderPath: moved.context.task.folder_path,
		}).catch(() => null);
		if (!source) {
			const destination = await resolveTaskFolderDestination({
				projectRoute: moved.context.sourceProject.main_route,
				folderPath: moved.context.task.folder_path,
			});
			const staging = join(
				moved.context.sourceProject.main_route,
				".koworker",
				".staging",
				input.runId,
				`restore-${moved.context.task.id}`,
			);
			await mkdir(dirname(staging), { recursive: true });
			await cp(moved.backup, staging, { recursive: true, errorOnExist: true, force: false });
			await verifyFingerprint(staging, moved.fingerprint);
			await mkdir(dirname(destination), { recursive: true });
			await rename(staging, destination);
		}
	}
}

export async function relinkTasks(input: {
	intents: TaskRelinkIntent[];
	deleteGroupIdAfter?: string;
}) {
	if (input.intents.length === 0) {
		return [];
	}
	const contexts = await Promise.all(input.intents.map(loadRelinkContext));
	const destinations = contexts.map(
		(context) => `${context.targetProject.id}:${context.destinationPath}`,
	);
	if (new Set(destinations).size !== destinations.length) {
		throw new Error("O relink produziria destinos duplicados");
	}
	const runId = crypto.randomUUID();
	const locks = await acquireProjectLocks({ contexts, runId });
	for (const project of locks.projects) {
		suppressTaskWatcher(project.id);
	}
	const moved: {
		backup: string;
		context: (typeof contexts)[number];
		fingerprint: TaskStorageFingerprint;
		published: boolean;
	}[] = [];

	try {
		const activeExecutions = await Promise.all(
			locks.projects.map((project) =>
				dbExecutionRuns.listRunningTaskIds(
					project.id,
					contexts
						.filter((context) => context.sourceProject.id === project.id)
						.map((context) => context.task.id),
				),
			),
		);
		if (activeExecutions.some((rows) => rows.length > 0)) {
			throw new Error("Há tarefas do relink com execução ativa");
		}

		for (const context of contexts) {
			if (
				context.sourceProject.id === context.targetProject.id &&
				context.task.folder_path === context.destinationPath
			) {
				continue;
			}
			await mkdir(join(context.targetProject.main_route, ".koworker"), { recursive: true });
			const source = await resolveExistingTaskFolder({
				projectRoute: context.sourceProject.main_route,
				folderPath: context.task.folder_path,
			});
			const fingerprint = await fingerprintTaskStorageDirectory(source);
			const destination = await resolveExistingTaskFolder({
				projectRoute: context.targetProject.main_route,
				folderPath: context.destinationPath,
			}).catch(() => null);
			if (destination) {
				await verifyFingerprint(destination, fingerprint);
			}

			const backup = join(
				context.sourceProject.main_route,
				".koworker",
				".backups",
				"relinks",
				runId,
				context.task.id,
			);
			await mkdir(dirname(backup), { recursive: true });
			await rename(source, backup);
			await verifyFingerprint(backup, fingerprint);
			const record = { backup, context, fingerprint, published: false };
			moved.push(record);

			if (!destination) {
				const staging = join(
					context.targetProject.main_route,
					".koworker",
					".staging",
					runId,
					context.task.id,
				);
				await mkdir(dirname(staging), { recursive: true });
				await cp(backup, staging, { recursive: true, errorOnExist: true, force: false });
				await verifyFingerprint(staging, fingerprint);
				const target = await resolveTaskFolderDestination({
					projectRoute: context.targetProject.main_route,
					folderPath: context.destinationPath,
				});
				await mkdir(dirname(target), { recursive: true });
				await rename(staging, target);
				record.published = true;
			}
		}

		await db.transaction().execute(async (trx) => {
			for (const context of contexts) {
				await trx
					.updateTable("tasks")
					.set({
						project_id: context.targetProject.id,
						group_id: context.intent.targetGroupId,
						folder_path: context.destinationPath,
						storage_slug: context.storageSlug,
						...(context.intent.displayOrder === undefined
							? {}
							: { display_order: context.intent.displayOrder }),
						...(context.intent.categoryId === undefined
							? {}
							: { category_id: context.intent.categoryId }),
						...(context.intent.done === undefined ? {} : { done: context.intent.done ? 1 : 0 }),
						...(context.intent.completedAt === undefined
							? {}
							: { completed_at: context.intent.completedAt }),
						...(context.intent.clearMergeMetadata
							? {
									merge_ready_at: null,
									worktree_branch: null,
									merge_target_branch: null,
									worktree_path: null,
									worktree_pr_url: null,
								}
							: {}),
						updated_at: Date.now(),
					})
					.where("id", "=", context.task.id)
					.executeTakeFirstOrThrow();
			}
			if (input.deleteGroupIdAfter) {
				await trx.deleteFrom("task_groups").where("id", "=", input.deleteGroupIdAfter).execute();
			}
		});

		return await Promise.all(contexts.map((context) => dbTasks.getById(context.task.id)));
	} catch (error) {
		await restoreFailedRelinks({ moved, runId });
		throw error;
	} finally {
		for (const project of locks.projects) {
			releaseTaskWatcher(project.id);
		}
		await locks.release();
	}
}

export async function quarantineTaskStorage(taskId: string) {
	const task = await dbTasks.getById(taskId);
	if (!task) {
		throw new Error("Tarefa não encontrada");
	}
	const project = await dbProjects.getById(task.project_id);
	if (!project) {
		throw new Error("Projeto não encontrado");
	}
	const runId = crypto.randomUUID();
	const lock = await acquireProjectLock({
		projectRoute: project.main_route,
		projectId: project.id,
		runId,
	});
	suppressTaskWatcher(project.id);
	let backup: string | null = null;
	let fingerprint: TaskStorageFingerprint | null = null;

	try {
		const activeRun = await dbTaskStorageRuns.getActiveByProject(project.id);
		if (activeRun) {
			throw new Error("O storage de tarefas deste projeto está em reconciliação");
		}
		const running = await dbExecutionRuns.listRunningTaskIds(project.id, [task.id]);
		if (running.length > 0) {
			throw new Error("A tarefa possui execução ativa");
		}
		const source = await resolveExistingTaskFolder({
			projectRoute: project.main_route,
			folderPath: task.folder_path,
		});
		fingerprint = await fingerprintTaskStorageDirectory(source);
		backup = join(project.main_route, ".koworker", ".backups", "deleted-tasks", runId, task.id);
		await mkdir(dirname(backup), { recursive: true });
		await rename(source, backup);
		await verifyFingerprint(backup, fingerprint);

		await db.transaction().execute(async (trx) => {
			const updated = await trx
				.updateTable("tasks")
				.set({ deleted_at: Date.now(), updated_at: Date.now() })
				.where("id", "=", task.id)
				.where("deleted_at", "is", null)
				.returning("id")
				.executeTakeFirst();
			if (!updated) {
				throw new Error("A tarefa não pôde ser marcada como removida");
			}
		});

		return { task, backup, fingerprint };
	} catch (error) {
		if (backup && fingerprint) {
			const source = await resolveExistingTaskFolder({
				projectRoute: project.main_route,
				folderPath: task.folder_path,
			}).catch(() => null);
			if (!source) {
				const destination = await resolveTaskFolderDestination({
					projectRoute: project.main_route,
					folderPath: task.folder_path,
				});
				await mkdir(dirname(destination), { recursive: true });
				await rename(backup, destination);
				await verifyFingerprint(destination, fingerprint);
			}
		}
		throw error;
	} finally {
		releaseTaskWatcher(project.id);
		await lock.release();
	}
}
