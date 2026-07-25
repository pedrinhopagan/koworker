import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "kysely";

const root = process.argv[2];
if (!root) {
	throw new Error("Raiz temporária não informada");
}

process.env.DATABASE_URL = join(root, "koworker.sqlite");
process.env.JWT_SECRET = "task-storage-coordinator-test-secret";
process.env.NODE_ENV = "development";

const successRoute = join(root, "success");
const obsoleteRoute = join(root, "obsolete");
const resumeRoute = join(root, "resume");
const missingRoute = join(root, "missing");
await Promise.all([
	mkdir(join(successRoute, ".koworker", "task-success"), { recursive: true }),
	mkdir(join(obsoleteRoute, ".koworker", "task-obsolete"), { recursive: true }),
	mkdir(join(resumeRoute, ".koworker", "task-resume"), { recursive: true }),
	mkdir(join(missingRoute, ".koworker", "task-missing"), { recursive: true }),
]);
await Bun.write(join(successRoute, ".koworker", "task-success", "index.md"), "# Conteúdo\n");
await Bun.write(join(obsoleteRoute, ".koworker", "task-obsolete", "index.md"), "# Antes\n");
await Bun.write(join(resumeRoute, ".koworker", "task-resume", "index.md"), "# Retomar\n");
await Bun.write(join(missingRoute, ".koworker", "task-missing", "index.md"), "# Sumido\n");

const { db } = await import("../db/connection");
const { ensureDbSchema } = await import("../db/migrate");
const { applyTaskStorage, resumeTaskStorage, rollbackTaskStorage } =
	await import("./task-storage-coordinator");
const { previewTaskStorage } = await import("./task-storage-scan");

ensureDbSchema();

await db
	.insertInto("projects")
	.values([
		{
			id: "aaaaaaaa-0000-4000-8000-000000000041",
			name: "Sucesso",
			color: "#000000",
			display_order: 0,
			main_route: successRoute,
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: 1,
		},
		{
			id: "aaaaaaaa-0000-4000-8000-000000000042",
			name: "Obsoleto",
			color: "#000000",
			display_order: 1,
			main_route: obsoleteRoute,
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: 2,
		},
		{
			id: "aaaaaaaa-0000-4000-8000-000000000043",
			name: "Retomada",
			color: "#000000",
			display_order: 2,
			main_route: resumeRoute,
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: 3,
		},
		{
			id: "aaaaaaaa-0000-4000-8000-000000000044",
			name: "Sumido",
			color: "#000000",
			display_order: 3,
			main_route: missingRoute,
			hide_terminal: 0,
			task_layout_version: 1,
			created_at: 4,
		},
	])
	.execute();
await db
	.insertInto("task_groups")
	.values([
		{
			id: "bbbbbbbb-0000-4000-8000-000000000041",
			project_id: "aaaaaaaa-0000-4000-8000-000000000041",
			name: "/Tarefas",
			storage_key: "bbbbbbbb",
			storage_slug: "tarefas",
			color: "#000000",
			display_order: 0,
			created_at: 1,
		},
		{
			id: "cccccccc-0000-4000-8000-000000000042",
			project_id: "aaaaaaaa-0000-4000-8000-000000000042",
			name: "/Vault",
			storage_key: "cccccccc",
			storage_slug: "vault",
			color: "#000000",
			display_order: 0,
			created_at: 2,
		},
		{
			id: "dddddddd-0000-4000-8000-000000000043",
			project_id: "aaaaaaaa-0000-4000-8000-000000000043",
			name: "/Agents",
			storage_key: "dddddddd",
			storage_slug: "agents",
			color: "#000000",
			display_order: 0,
			created_at: 3,
		},
		{
			id: "eeeeeeee-0000-4000-8000-000000000044",
			name: "/Sumidos",
			project_id: "aaaaaaaa-0000-4000-8000-000000000044",
			storage_key: "eeeeeeee",
			storage_slug: "sumidos",
			color: "#000000",
			display_order: 0,
			created_at: 4,
		},
	])
	.execute();
await db
	.insertInto("tasks")
	.values([
		{
			id: "11111111-aaaa-4000-8000-000000000041",
			project_id: "aaaaaaaa-0000-4000-8000-000000000041",
			folder_path: ".koworker/task-success",
			storage_key: "11111111",
			storage_slug: "conteudo",
			title: "Conteúdo",
			group_id: "bbbbbbbb-0000-4000-8000-000000000041",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 1,
		},
		{
			id: "22222222-aaaa-4000-8000-000000000042",
			project_id: "aaaaaaaa-0000-4000-8000-000000000042",
			folder_path: ".koworker/task-obsolete",
			storage_key: "22222222",
			storage_slug: "antes",
			title: "Antes",
			group_id: "cccccccc-0000-4000-8000-000000000042",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 2,
		},
		{
			id: "33333333-aaaa-4000-8000-000000000043",
			project_id: "aaaaaaaa-0000-4000-8000-000000000043",
			folder_path: ".koworker/task-resume",
			storage_key: "33333333",
			storage_slug: "retomar",
			title: "Retomar",
			group_id: "dddddddd-0000-4000-8000-000000000043",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 3,
		},
		{
			id: "44444444-aaaa-4000-8000-000000000044",
			project_id: "aaaaaaaa-0000-4000-8000-000000000044",
			folder_path: ".koworker/task-missing",
			storage_key: "44444444",
			storage_slug: "sumido",
			title: "Sumido",
			group_id: "eeeeeeee-0000-4000-8000-000000000044",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 4,
		},
	])
	.execute();

const successPreview = await previewTaskStorage("aaaaaaaa-0000-4000-8000-000000000041");
const completed = await applyTaskStorage({
	projectId: "aaaaaaaa-0000-4000-8000-000000000041",
	planHash: successPreview.planHash,
	confirmed: true,
});
const successTask = await db
	.selectFrom("tasks as t")
	.selectAll("t")
	.where("t.id", "=", "11111111-aaaa-4000-8000-000000000041")
	.executeTakeFirstOrThrow();
const successProject = await db
	.selectFrom("projects as p")
	.selectAll("p")
	.where("p.id", "=", "aaaaaaaa-0000-4000-8000-000000000041")
	.executeTakeFirstOrThrow();
const successRescan = await previewTaskStorage("aaaaaaaa-0000-4000-8000-000000000041");

const backupFile = completed?.backup_path
	? join(completed.backup_path, "files", successTask.id, "index.md")
	: "";
const snapshotFile = completed?.backup_path ? join(completed.backup_path, "database.sqlite") : "";
const manifestFile = completed?.backup_path ? join(completed.backup_path, "manifest.json") : "";
const successArtifacts = {
	backupContent: backupFile ? await Bun.file(backupFile).text() : null,
	destinationContent: await Bun.file(
		join(successRoute, successTask.folder_path, "index.md"),
	).text(),
	manifestExists: manifestFile ? await Bun.file(manifestFile).exists() : false,
	snapshotExists: snapshotFile ? await Bun.file(snapshotFile).exists() : false,
	sourceExists: await Bun.file(
		join(successRoute, ".koworker", "task-success", "index.md"),
	).exists(),
};
const resumedCompleted = completed ? await resumeTaskStorage(completed.id) : null;
const rolledBack = completed ? await rollbackTaskStorage(completed.id) : null;
const rolledBackTask = await db
	.selectFrom("tasks as t")
	.selectAll("t")
	.where("t.id", "=", "11111111-aaaa-4000-8000-000000000041")
	.executeTakeFirstOrThrow();
const rolledBackProject = await db
	.selectFrom("projects as p")
	.selectAll("p")
	.where("p.id", "=", "aaaaaaaa-0000-4000-8000-000000000041")
	.executeTakeFirstOrThrow();

const obsoletePreview = await previewTaskStorage("aaaaaaaa-0000-4000-8000-000000000042");
await Bun.write(join(obsoleteRoute, ".koworker", "task-obsolete", "index.md"), "# Depois\n");
let obsoleteError: string | undefined;
try {
	await applyTaskStorage({
		projectId: "aaaaaaaa-0000-4000-8000-000000000042",
		planHash: obsoletePreview.planHash,
		confirmed: true,
	});
} catch (error) {
	obsoleteError = error instanceof Error ? error.message : String(error);
}
const obsoleteRuns = await db
	.selectFrom("task_storage_runs as tsr")
	.select("tsr.id")
	.where("tsr.project_id", "=", "aaaaaaaa-0000-4000-8000-000000000042")
	.execute();

const resumePreview = await previewTaskStorage("aaaaaaaa-0000-4000-8000-000000000043");
await sql`CREATE TRIGGER fail_storage_commit
	BEFORE UPDATE OF task_layout_version ON projects
	WHEN NEW.id = 'aaaaaaaa-0000-4000-8000-000000000043' AND NEW.task_layout_version = 2
	BEGIN SELECT RAISE(ABORT, 'falha injetada'); END`.execute(db);
let injectedError: string | undefined;
try {
	await applyTaskStorage({
		projectId: "aaaaaaaa-0000-4000-8000-000000000043",
		planHash: resumePreview.planHash,
		confirmed: true,
	});
} catch (error) {
	injectedError = error instanceof Error ? error.message : String(error);
}
await sql`DROP TRIGGER fail_storage_commit`.execute(db);
const blockedRun = await db
	.selectFrom("task_storage_runs as tsr")
	.selectAll("tsr")
	.where("tsr.project_id", "=", "aaaaaaaa-0000-4000-8000-000000000043")
	.executeTakeFirstOrThrow();
const resumed = await resumeTaskStorage(blockedRun.id);
const resumedTask = await db
	.selectFrom("tasks as t")
	.selectAll("t")
	.where("t.id", "=", "33333333-aaaa-4000-8000-000000000043")
	.executeTakeFirstOrThrow();

const missingPreview = await previewTaskStorage("aaaaaaaa-0000-4000-8000-000000000044");
await sql`CREATE TRIGGER skip_task_commit
	BEFORE UPDATE OF folder_path ON tasks
	WHEN NEW.id = '44444444-aaaa-4000-8000-000000000044'
	BEGIN SELECT RAISE(IGNORE); END`.execute(db);
let missingError: string | undefined;
try {
	await applyTaskStorage({
		projectId: "aaaaaaaa-0000-4000-8000-000000000044",
		planHash: missingPreview.planHash,
		confirmed: true,
	});
} catch (error) {
	missingError = error instanceof Error ? error.message : String(error);
}
await sql`DROP TRIGGER skip_task_commit`.execute(db);
const missingTask = await db
	.selectFrom("tasks as t")
	.selectAll("t")
	.where("t.id", "=", "44444444-aaaa-4000-8000-000000000044")
	.executeTakeFirstOrThrow();
const missingRun = await db
	.selectFrom("task_storage_runs as tsr")
	.selectAll("tsr")
	.where("tsr.project_id", "=", "aaaaaaaa-0000-4000-8000-000000000044")
	.executeTakeFirstOrThrow();
const missingProject = await db
	.selectFrom("projects as p")
	.selectAll("p")
	.where("p.id", "=", "aaaaaaaa-0000-4000-8000-000000000044")
	.executeTakeFirstOrThrow();

await db.destroy();

console.log(
	JSON.stringify({
		backupContent: successArtifacts.backupContent,
		completedStatus: completed?.status,
		destinationContent: successArtifacts.destinationContent,
		manifestExists: successArtifacts.manifestExists,
		injectedError,
		missingError,
		missingFolderPath: missingTask.folder_path,
		missingProjectVersion: missingProject.task_layout_version,
		missingRunStatus: missingRun.status,
		obsoleteError,
		obsoleteRuns: obsoleteRuns.length,
		projectVersion: successProject.task_layout_version,
		rescan: successRescan.totals,
		resumedStatus: resumedCompleted?.status,
		recoveredContent: await Bun.file(join(resumeRoute, resumedTask.folder_path, "index.md")).text(),
		recoveredStatus: resumed?.status,
		rollbackContent: await Bun.file(
			join(successRoute, rolledBackTask.folder_path, "index.md"),
		).text(),
		rollbackPath: rolledBackTask.folder_path,
		rollbackProjectVersion: rolledBackProject.task_layout_version,
		rollbackStatus: rolledBack?.status,
		snapshotExists: successArtifacts.snapshotExists,
		sourceExists: successArtifacts.sourceExists,
	}),
);
