import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "koworker-task-storage-coordinator-"));
let result: {
	backupContent: string | null;
	completedStatus?: string;
	destinationContent: string;
	manifestExists: boolean;
	injectedError?: string;
	missingError?: string;
	missingFolderPath: string;
	missingProjectVersion: number;
	missingRunStatus: string;
	obsoleteError?: string;
	obsoleteRuns: number;
	projectVersion: number;
	rescan: { blocked: number; correct: number; orphaned: number; toApply: number };
	resumedStatus?: string;
	recoveredContent: string;
	recoveredStatus?: string;
	rollbackContent: string;
	rollbackPath: string;
	rollbackProjectVersion: number;
	rollbackStatus?: string;
	snapshotExists: boolean;
	sourceExists: boolean;
};

beforeAll(async () => {
	const child = Bun.spawn(
		["bun", "run", "src/api/helpers/task-storage-coordinator-test-runner.ts", root],
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
	if (exitCode !== 0) {
		throw new Error(stderr);
	}

	result = JSON.parse(stdout);
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("applyTaskStorage", () => {
	test("publica v2 somente após snapshot e backup verificados", () => {
		expect(result.completedStatus).toBe("completed");
		expect(result.projectVersion).toBe(2);
		expect(result.destinationContent).toBe("# Conteúdo\n");
		expect(result.backupContent).toBe("# Conteúdo\n");
		expect(result.snapshotExists).toBeTrue();
		expect(result.manifestExists).toBeTrue();
		expect(result.sourceExists).toBeFalse();
		expect(result.rescan).toEqual({ blocked: 0, correct: 1, orphaned: 0, toApply: 0 });
		expect(result.resumedStatus).toBe("completed");
	});

	test("recusa planHash obsoleto antes de criar run ou mover conteúdo", () => {
		expect(result.obsoleteError).toBe("O plano de reconciliação ficou obsoleto");
		expect(result.obsoleteRuns).toBe(0);
	});

	test("faz rollback sem sobrescrever nem apagar o backup", () => {
		expect(result.rollbackStatus).toBe("rolled_back");
		expect(result.rollbackProjectVersion).toBe(1);
		expect(result.rollbackPath).toBe(".koworker/task-success");
		expect(result.rollbackContent).toBe("# Conteúdo\n");
		expect(result.backupContent).toBe("# Conteúdo\n");
	});

	test("aborta o commit quando o update da tarefa não atinge nenhuma linha", () => {
		expect(result.missingError).toContain("não existe mais para receber o commit");
		expect(result.missingFolderPath).toBe(".koworker/task-missing");
		expect(result.missingProjectVersion).toBe(1);
		expect(result.missingRunStatus).toBe("blocked");
	});

	test("retoma pelo journal após falha entre publicação e commit", () => {
		expect(result.injectedError).toContain("falha injetada");
		expect(result.recoveredStatus).toBe("completed");
		expect(result.recoveredContent).toBe("# Retomar\n");
	});
});
