import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, open, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "task-storage-lock-test-secret";
process.env.NODE_ENV = "development";

const root = await mkdtemp(join(tmpdir(), "koworker-task-storage-lock-"));
const projectId = "aaaaaaaa-0000-4000-8000-000000000061";
const taskId = "dddddddd-0000-4000-8000-000000000061";
const staleFolderPath = ".koworker/tasks/_sem-feature/antiga--dddddddd";
const movedFolderPath = ".koworker/tasks/_sem-feature/nova--dddddddd";
const locksDirectory = join(root, ".koworker", ".staging", "locks");
const lockFile = join(locksDirectory, `${projectId}.lock`);
let db: typeof import("../db/connection").db;
let applyTaskStorage: typeof import("./task-storage-coordinator").applyTaskStorage;
let purgeOrphanStorageLocks: typeof import("./task-storage-coordinator").purgeOrphanStorageLocks;
let withProjectStorageLock: typeof import("./task-storage-coordinator").withProjectStorageLock;

async function deadPid() {
	const process = Bun.spawn(["true"]);
	await process.exited;

	return process.pid;
}

beforeAll(async () => {
	({ db } = await import("../db/connection"));
	({ applyTaskStorage, purgeOrphanStorageLocks, withProjectStorageLock } =
		await import("./task-storage-coordinator"));

	await db
		.insertInto("projects")
		.values({
			id: projectId,
			name: "Projeto lock",
			color: "#000000",
			display_order: 0,
			main_route: root,
			hide_terminal: 0,
			task_layout_version: 2,
			created_at: 1,
		})
		.execute();
	await db
		.insertInto("tasks")
		.values({
			id: taskId,
			project_id: projectId,
			folder_path: staleFolderPath,
			storage_key: "dddddddd",
			storage_slug: "antiga",
			title: "antiga",
			complexity: "medio",
			display_order: 0,
			done: 0,
			created_at: 1,
		})
		.execute();
	await mkdir(locksDirectory, { recursive: true });
});

afterAll(async () => {
	await db.deleteFrom("tasks").where("id", "=", taskId).execute();
	await db.deleteFrom("projects").where("id", "=", projectId).execute();
	await rm(root, { recursive: true, force: true });
});

describe("withProjectStorageLock", () => {
	test("serializa mutations concorrentes do mesmo projeto sem erro", async () => {
		const events: string[] = [];
		let running = 0;
		let maxRunning = 0;

		const mutation = (name: string) =>
			withProjectStorageLock({ projectId, projectRoute: root }, async () => {
				running += 1;
				maxRunning = Math.max(maxRunning, running);
				events.push(`inicio-${name}`);
				await Bun.sleep(20);
				events.push(`fim-${name}`);
				running -= 1;

				return name;
			});

		const results = await Promise.all([mutation("a"), mutation("b")]);

		expect(results).toEqual(["a", "b"]);
		expect(maxRunning).toBe(1);
		expect(events).toEqual(["inicio-a", "fim-a", "inicio-b", "fim-b"]);
	});

	test("a fila continua viva depois de uma mutation que falha", async () => {
		const failed = withProjectStorageLock({ projectId, projectRoute: root }, () =>
			Promise.reject(new Error("falha de mutation")),
		);

		await expect(failed).rejects.toThrow("falha de mutation");
		await expect(
			withProjectStorageLock({ projectId, projectRoute: root }, () => Promise.resolve("ok")),
		).resolves.toBe("ok");
	});

	test("recusa mutation com reconciliação ativa em outro processo", async () => {
		await writeFile(
			lockFile,
			JSON.stringify({ pid: process.pid, runId: "reconciliacao", owner: "outro" }),
		);

		try {
			await expect(
				withProjectStorageLock({ projectId, projectRoute: root }, () =>
					Promise.resolve("nao deveria"),
				),
			).rejects.toThrow("O storage de tarefas deste projeto está em reconciliação");
		} finally {
			await rm(lockFile, { force: true });
		}

		await expect(
			withProjectStorageLock({ projectId, projectRoute: root }, () => Promise.resolve("liberado")),
		).resolves.toBe("liberado");
	});

	test("mantém o lock de arquivo durante toda a mutation", async () => {
		const held = await withProjectStorageLock({ projectId, projectRoute: root }, async () => {
			const lock = JSON.parse(await readFile(lockFile, "utf8")) as {
				pid: number;
				kind: string;
			};
			await expect(open(lockFile, "wx")).rejects.toThrow();

			return lock;
		});

		expect(held).toMatchObject({ pid: process.pid, kind: "mutation" });
		expect(await readdir(locksDirectory)).toEqual([]);
	});

	test("recusa mutation enquanto outro processo mantém o lock de reconciliação", async () => {
		const holder = Bun.spawn(["sleep", "30"]);
		await writeFile(
			lockFile,
			JSON.stringify({
				pid: holder.pid,
				runId: "reconciliacao",
				kind: "reconciliation",
				owner: "outro-processo",
			}),
		);
		let executed = false;

		try {
			await expect(
				withProjectStorageLock({ projectId, projectRoute: root }, () => {
					executed = true;
					return Promise.resolve("nao deveria");
				}),
			).rejects.toThrow("O storage de tarefas deste projeto está em reconciliação");

			expect(executed).toBe(false);
			expect(await readFile(lockFile, "utf8")).toContain("outro-processo");
		} finally {
			holder.kill();
			await holder.exited;
			await rm(lockFile, { force: true });
		}
	});

	test("não assume lock com payload ilegível dentro do período de graça", async () => {
		await writeFile(lockFile, "");
		let executed = false;
		const mutation = withProjectStorageLock({ projectId, projectRoute: root }, () => {
			executed = true;
			return Promise.resolve("liberado");
		});

		await Bun.sleep(200);

		expect(executed).toBe(false);
		expect(await readFile(lockFile, "utf8")).toBe("");

		await rm(lockFile, { force: true });
		await expect(mutation).resolves.toBe("liberado");
		expect(await readdir(locksDirectory)).toEqual([]);
	});

	test("assume lock com payload ilegível depois do período de graça", async () => {
		await writeFile(lockFile, "{ilegivel");
		const expired = new Date(Date.now() - 120_000);
		await utimes(lockFile, expired, expired);

		await expect(
			withProjectStorageLock({ projectId, projectRoute: root }, () => Promise.resolve("assumiu")),
		).resolves.toBe("assumiu");
		expect(await readdir(locksDirectory)).toEqual([]);
	});

	test("não deixa lock para trás quando a reconciliação falha antes do corpo", async () => {
		await expect(
			applyTaskStorage({ projectId, planHash: "hash-invalido", confirmed: true }),
		).rejects.toThrow();
		expect(await readdir(locksDirectory)).toEqual([]);
	});

	test("não deixa lock para trás quando a operação da mutation falha", async () => {
		await expect(
			withProjectStorageLock({ projectId, projectRoute: root }, () =>
				Promise.reject(new Error("falha no corpo")),
			),
		).rejects.toThrow("falha no corpo");
		expect(await readdir(locksDirectory)).toEqual([]);
	});

	test("aborta mutation cujo folder_path mudou enquanto ela esperava a vez", async () => {
		const stale = {
			id: taskId,
			project_id: projectId,
			folder_path: staleFolderPath,
		};
		const reconciliation = withProjectStorageLock({ projectId, projectRoute: root }, async () => {
			await Bun.sleep(20);
			await db
				.updateTable("tasks")
				.set({ folder_path: movedFolderPath })
				.where("id", "=", taskId)
				.execute();
		});
		const mutation = withProjectStorageLock(
			{ projectId, projectRoute: root, task: stale },
			async () => {
				await Bun.write(join(root, staleFolderPath, "index.md"), "ressuscitado");
				return "gravou";
			},
		);

		await reconciliation;
		await expect(mutation).rejects.toThrow("O storage desta tarefa mudou");
		expect(await Bun.file(join(root, staleFolderPath, "index.md")).exists()).toBe(false);
		expect(await readdir(locksDirectory)).toEqual([]);
	});
});

describe("purgeOrphanStorageLocks", () => {
	test("limpa lock de PID morto e resíduos, preservando lock vivo", async () => {
		const residue = join(locksDirectory, `${projectId}.lock.released.abc`);
		const alive = join(locksDirectory, "aaaaaaaa-0000-4000-8000-000000000062.lock");
		await writeFile(lockFile, JSON.stringify({ pid: await deadPid(), owner: "morto" }));
		await writeFile(residue, JSON.stringify({ pid: process.pid, owner: "residuo" }));
		await writeFile(alive, JSON.stringify({ pid: process.pid, owner: "vivo" }));

		await purgeOrphanStorageLocks();

		expect(await readdir(locksDirectory)).toEqual(["aaaaaaaa-0000-4000-8000-000000000062.lock"]);
		await rm(alive, { force: true });
	});

	test("preserva lock com payload ilegível recente e remove o expirado", async () => {
		const expiredLock = join(locksDirectory, "aaaaaaaa-0000-4000-8000-000000000063.lock");
		await writeFile(lockFile, "");
		await writeFile(expiredLock, "{ilegivel");
		const expired = new Date(Date.now() - 120_000);
		await utimes(expiredLock, expired, expired);

		await purgeOrphanStorageLocks();

		expect(await readdir(locksDirectory)).toEqual([`${projectId}.lock`]);
		await rm(lockFile, { force: true });
	});

	test("preserva temporário recente e remove o temporário expirado", async () => {
		const recent = join(locksDirectory, `${projectId}.lock.tmp.recente`);
		const stale = join(locksDirectory, `${projectId}.lock.tmp.antigo`);
		await writeFile(recent, JSON.stringify({ pid: process.pid, owner: "em-criacao" }));
		await writeFile(stale, JSON.stringify({ pid: process.pid, owner: "abandonado" }));
		const expired = new Date(Date.now() - 120_000);
		await utimes(stale, expired, expired);

		await purgeOrphanStorageLocks();

		expect(await readdir(locksDirectory)).toEqual([`${projectId}.lock.tmp.recente`]);
		await rm(recent, { force: true });
	});

	test("preserva lock de processo de outro usuário", async () => {
		await writeFile(lockFile, JSON.stringify({ pid: 1, owner: "outro-usuario" }));

		await purgeOrphanStorageLocks();

		expect(await readFile(lockFile, "utf8")).toContain("outro-usuario");
		await rm(lockFile, { force: true });
	});
});
