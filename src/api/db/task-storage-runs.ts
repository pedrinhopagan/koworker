import { db, type task_storage_runs } from "./connection";

const taskStorageRunTransitions = {
	backUp: { from: ["planned"], to: "backed_up" },
	startApply: { from: ["backed_up"], to: "applying_fs" },
	commitDb: { from: ["applying_fs"], to: "committed_db" },
	verify: { from: ["committed_db"], to: "verified" },
	complete: { from: ["verified"], to: "completed" },
	block: {
		from: ["planned", "backed_up", "applying_fs", "committed_db", "verified"],
		to: "blocked",
	},
	requireRollback: {
		from: ["backed_up", "applying_fs", "committed_db", "verified", "completed", "blocked"],
		to: "rollback_required",
	},
	rollBack: { from: ["rollback_required"], to: "rolled_back" },
	resumeBackedUp: { from: ["blocked"], to: "backed_up" },
	resumeApplying: { from: ["blocked"], to: "applying_fs" },
	resumeCommitted: { from: ["blocked"], to: "committed_db" },
	resumeVerified: { from: ["blocked"], to: "verified" },
} as const satisfies Record<
	string,
	{ from: readonly task_storage_runs["status"][]; to: task_storage_runs["status"] }
>;

export type TaskStorageRunTransition = keyof typeof taskStorageRunTransitions;

type TaskStorageRunCreate = Pick<
	task_storage_runs,
	"id" | "project_id" | "plan_hash" | "from_layout_version" | "to_layout_version" | "manifest"
> &
	Partial<Pick<task_storage_runs, "lock_owner">>;

type TaskStorageRunTransitionPatch = Partial<
	Pick<task_storage_runs, "backup_path" | "lock_owner" | "error">
>;

export const dbTaskStorageRuns = {
	create(input: TaskStorageRunCreate) {
		const now = Date.now();

		return db
			.insertInto("task_storage_runs")
			.values({
				...input,
				status: "planned",
				created_at: now,
				updated_at: now,
			})
			.returningAll()
			.executeTakeFirstOrThrow();
	},

	getById(id: string) {
		return db
			.selectFrom("task_storage_runs as tsr")
			.selectAll("tsr")
			.where("tsr.id", "=", id)
			.executeTakeFirst();
	},

	getActiveByProject(projectId: string) {
		return db
			.selectFrom("task_storage_runs as tsr")
			.selectAll("tsr")
			.where("tsr.project_id", "=", projectId)
			.where("tsr.status", "not in", ["completed", "rolled_back"])
			.orderBy("tsr.created_at", "desc")
			.executeTakeFirst();
	},

	getLatestByProject(projectId: string) {
		return db
			.selectFrom("task_storage_runs as tsr")
			.selectAll("tsr")
			.where("tsr.project_id", "=", projectId)
			.orderBy("tsr.created_at", "desc")
			.executeTakeFirst();
	},

	claimLock(input: { id: string; lockOwner: string }) {
		return db
			.updateTable("task_storage_runs")
			.set({ lock_owner: input.lockOwner, updated_at: Date.now() })
			.where("id", "=", input.id)
			.where("status", "not in", ["completed", "rolled_back"])
			.returningAll()
			.executeTakeFirst();
	},

	async transition(input: {
		id: string;
		transition: TaskStorageRunTransition;
		patch?: TaskStorageRunTransitionPatch;
	}) {
		const transition = taskStorageRunTransitions[input.transition];
		const now = Date.now();
		const completedAt =
			transition.to === "completed" || transition.to === "rolled_back" ? now : undefined;
		const updated = await db
			.updateTable("task_storage_runs")
			.set({
				...input.patch,
				status: transition.to,
				updated_at: now,
				completed_at: completedAt,
			})
			.where("id", "=", input.id)
			.where("status", "in", [...transition.from])
			.returningAll()
			.executeTakeFirst();

		if (updated) {
			return updated;
		}

		return db
			.selectFrom("task_storage_runs as tsr")
			.selectAll("tsr")
			.where("tsr.id", "=", input.id)
			.where("tsr.status", "=", transition.to)
			.executeTakeFirst();
	},
};
