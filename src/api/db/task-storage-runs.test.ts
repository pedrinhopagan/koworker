import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "koworker-task-storage-runs-"));
let result: {
	backedUp?: string;
	retried?: string;
	backupPath?: string;
	completedAt?: number;
	illegal?: string;
	unchanged?: string;
	concurrentSuccesses: number;
	concurrentStatus?: string;
	duplicateError: boolean;
};

beforeAll(async () => {
	const child = Bun.spawn(
		[process.execPath, "run", "src/api/db/task-storage-runs-test-runner.ts", root],
		{
			cwd: process.cwd(),
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	if (exitCode !== 0) throw new Error(stderr);
	result = JSON.parse(stdout);
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("dbTaskStorageRuns", () => {
	test("aceita o fluxo legal e repete a confirmação de forma idempotente", () => {
		expect(result.backedUp).toBe("backed_up");
		expect(result.retried).toBe("backed_up");
		expect(result.backupPath).toBe(".koworker/.backups/layout-v2/run-flow");
		expect(result.completedAt).toBeNumber();
	});

	test("recusa origem ilegal sem alterar o run", () => {
		expect(result.illegal).toBeUndefined();
		expect(result.unchanged).toBe("planned");
	});

	test("permite somente uma transição concorrente a partir da mesma origem", () => {
		expect(result.concurrentSuccesses).toBe(1);
		if (!result.concurrentStatus) throw new Error("Status concorrente não retornado");
		expect(["applying_fs", "committed_db"]).toContain(result.concurrentStatus);
	});

	test("impede dois runs ativos no mesmo projeto", () => {
		expect(result.duplicateError).toBeTrue();
	});
});
