import { protectedProcedure } from "../auth/context";
import { dbTaskStorageRuns } from "../db/task-storage-runs";
import {
	applyTaskStorage,
	resumeTaskStorage,
	rollbackTaskStorage,
} from "../helpers/task-storage-coordinator";
import { previewTaskStorage } from "../helpers/task-storage-scan";
import {
	TaskStorageApplySchema,
	TaskStoragePlanSchema,
	TaskStoragePreviewSchema,
	TaskStorageRunSchema,
} from "../schemas/task-storage";

function mapTaskStorageRun(
	run: NonNullable<Awaited<ReturnType<typeof dbTaskStorageRuns.getById>>>,
) {
	return {
		id: run.id,
		projectId: run.project_id,
		planHash: run.plan_hash,
		fromLayoutVersion: run.from_layout_version,
		toLayoutVersion: run.to_layout_version,
		status: run.status,
		manifest: TaskStoragePlanSchema.parse(JSON.parse(run.manifest)),
		backupPath: run.backup_path || undefined,
		lockOwner: run.lock_owner || undefined,
		error: run.error || undefined,
		createdAt: run.created_at,
		updatedAt: run.updated_at,
		completedAt: run.completed_at || undefined,
	};
}

export const taskStorageRouter = {
	preview: protectedProcedure
		.input(TaskStoragePreviewSchema)
		.handler(({ input }) => previewTaskStorage(input.projectId)),
	apply: protectedProcedure
		.input(TaskStorageApplySchema)
		.handler(({ input }) => applyTaskStorage(input)),
	resume: protectedProcedure
		.input(TaskStorageRunSchema)
		.handler(({ input }) => resumeTaskStorage(input.runId)),
	rollback: protectedProcedure
		.input(TaskStorageRunSchema)
		.handler(({ input }) => rollbackTaskStorage(input.runId)),

	getRun: protectedProcedure.input(TaskStorageRunSchema).handler(async ({ input }) => {
		const run = await dbTaskStorageRuns.getById(input.runId);

		return run ? mapTaskStorageRun(run) : null;
	}),

	getLatest: protectedProcedure.input(TaskStoragePreviewSchema).handler(async ({ input }) => {
		const run = await dbTaskStorageRuns.getLatestByProject(input.projectId);
		return run ? mapTaskStorageRun(run) : null;
	}),
};
