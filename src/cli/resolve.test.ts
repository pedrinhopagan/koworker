import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "koworker-cli-resolve-"));
let result: {
	byId?: string;
	byKey?: string;
	byPath?: string;
	crossProject?: string;
};

beforeAll(async () => {
	const child = Bun.spawn(["bun", "run", "src/cli/resolve-test-runner.ts", root], {
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

describe("resolveTask", () => {
	test("resolve UUID, storage key e path nested somente no projeto do cwd", () => {
		expect(result).toEqual({
			byId: "11111111-aaaa-4000-8000-000000000021",
			byKey: "11111111-aaaa-4000-8000-000000000021",
			byPath: "11111111-aaaa-4000-8000-000000000021",
		});
	});
});
