import { join } from "node:path";

const root = process.argv[2];
if (!root) throw new Error("Raiz temporária não informada");

process.env.DATABASE_URL = join(root, "task-storage-runs.sqlite");
process.env.JWT_SECRET = "task-storage-runs-test-secret";
process.env.NODE_ENV = "development";

const { db } = await import("./connection");
const { dbTaskStorageRuns } = await import("./task-storage-runs");
const { ensureDbSchema } = await import("./migrate");

ensureDbSchema();

async function createProject(id: string) {
	await db
		.insertInto("projects")
		.values({
			id,
			name: id,
			color: "#000000",
			display_order: 0,
			main_route: join(root, id),
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: 1,
		})
		.execute();
}

async function createRun(id: string, projectId: string) {
	await createProject(projectId);
	return dbTaskStorageRuns.create({
		id,
		project_id: projectId,
		plan_hash: `hash-${id}`,
		from_layout_version: 1,
		to_layout_version: 2,
		manifest: "{}",
	});
}

await createRun("run-flow", "project-flow");
const backedUp = await dbTaskStorageRuns.transition({
	id: "run-flow",
	transition: "backUp",
	patch: { backup_path: ".koworker/.backups/layout-v2/run-flow" },
});
const retried = await dbTaskStorageRuns.transition({ id: "run-flow", transition: "backUp" });
for (const transition of ["startApply", "commitDb", "verify", "complete"] as const) {
	await dbTaskStorageRuns.transition({ id: "run-flow", transition });
}
const completed = await dbTaskStorageRuns.getById("run-flow");

await createRun("run-illegal", "project-illegal");
const illegal = await dbTaskStorageRuns.transition({ id: "run-illegal", transition: "commitDb" });
const unchanged = await dbTaskStorageRuns.getById("run-illegal");

await createRun("run-concurrent", "project-concurrent");
await dbTaskStorageRuns.transition({ id: "run-concurrent", transition: "backUp" });
await dbTaskStorageRuns.transition({ id: "run-concurrent", transition: "block" });
const concurrent = await Promise.all([
	dbTaskStorageRuns.transition({ id: "run-concurrent", transition: "resumeApplying" }),
	dbTaskStorageRuns.transition({ id: "run-concurrent", transition: "resumeCommitted" }),
]);
const concurrentRun = await dbTaskStorageRuns.getById("run-concurrent");

await createRun("run-active", "project-active");
let duplicateError = false;
try {
	await dbTaskStorageRuns.create({
		id: "run-active-duplicate",
		project_id: "project-active",
		plan_hash: "hash-duplicate",
		from_layout_version: 1,
		to_layout_version: 2,
		manifest: "{}",
	});
} catch {
	duplicateError = true;
}

console.log(
	JSON.stringify({
		backedUp: backedUp?.status,
		retried: retried?.status,
		backupPath: retried?.backup_path,
		completedAt: completed?.completed_at,
		illegal: illegal?.status,
		unchanged: unchanged?.status,
		concurrentSuccesses: concurrent.filter(Boolean).length,
		concurrentStatus: concurrentRun?.status,
		duplicateError,
	}),
);
