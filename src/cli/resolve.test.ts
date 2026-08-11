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
	reported: string[] | null;
};

beforeAll(async () => {
	const child = Bun.spawn([process.execPath, "run", "src/cli/resolve-test-runner.ts", root], {
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
		expect({
			byId: result.byId,
			byKey: result.byKey,
			byPath: result.byPath,
			crossProject: result.crossProject,
		}).toEqual({
			byId: "11111111-aaaa-4000-8000-000000000021",
			byKey: "11111111-aaaa-4000-8000-000000000021",
			byPath: "11111111-aaaa-4000-8000-000000000021",
			crossProject: undefined,
		});
	});

	test("apontar a CLI para uma tarefa vincula a sessão do pane a ela", () => {
		expect(result.reported).toEqual([
			"pane",
			"report-task",
			"w1:p1",
			"--task-id",
			"11111111-aaaa-4000-8000-000000000021",
			"--title",
			"Storage",
			"--route",
			"/tarefas/sem-feature/11111111-aaaa-4000-8000-000000000021",
		]);
	});
});
