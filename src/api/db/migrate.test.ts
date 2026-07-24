import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "koworker-storage-migrate-"));
let result: {
	content: string;
	first: { folder_path: string; storage_key: string | null; storage_slug: string | null }[];
	mtimePreserved: boolean;
	pathIndex: { name: string } | null;
	second: { folder_path: string; storage_key: string | null; storage_slug: string | null }[];
};

beforeAll(async () => {
	const child = Bun.spawn(["bun", "run", "src/api/db/migrate-test-runner.ts", root], {
		cwd: process.cwd(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	if (exitCode !== 0) {
		throw new Error(stderr);
	}

	result = JSON.parse(stdout);
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("ensureDbSchema", () => {
	test("faz backfill idempotente sem alterar folder_path nem o workspace", () => {
		expect(result.first).toEqual(result.second);
		expect(result.first.map((task) => task.storage_key)).toEqual(["12345678", "12345678bbbb"]);
		expect(result.first.map((task) => task.storage_slug)).toEqual([null, null]);
		expect(result.first.map((task) => task.folder_path)).toEqual([
			".koworker/adotada",
			".koworker/adotada",
		]);
		expect(result.content).toBe("# Preservada\n");
		expect(result.mtimePreserved).toBeTrue();
	});

	test("mantém duplicatas legadas visíveis para preflight sem derrubar o boot", () => {
		expect(result.pathIndex).toBeNull();
	});
});
