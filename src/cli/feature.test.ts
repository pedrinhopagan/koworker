import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "koworker-cli-feature-"));
let result: {
	featureCreate: { exitCode: number; stdout: string; stderr: string };
	duplicateFeatureCreate: { exitCode: number; stdout: string; stderr: string };
	featureSearch: { exitCode: number; stdout: string; stderr: string };
	featureByProject: { exitCode: number; stdout: string; stderr: string };
	taskCreate: { exitCode: number; stdout: string; stderr: string };
	taskWithoutFeature: { exitCode: number; stdout: string; stderr: string };
	ambiguousTaskCreate: { exitCode: number; stdout: string; stderr: string };
	createdFeature?: {
		id: string;
		storageKeyLength?: number;
		storageSlug: string | null;
		displayOrder: number;
	};
	createdTask?: { groupId: string | null; folderPath: string; indexExists: boolean };
};

beforeAll(async () => {
	const child = Bun.spawn(["bun", "run", "src/cli/feature-test-runner.ts", root], {
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
}, 60_000);

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("kw-cli feature", () => {
	test("cria feature com identidade de storage e ordem do projeto", () => {
		expect(result.featureCreate).toMatchObject({ exitCode: 0, stderr: "" });
		expect(result.featureCreate.stdout).toContain('Feature "Nova Área" criada.');
		expect(result.createdFeature).toMatchObject({
			storageKeyLength: 8,
			storageSlug: "nova-area",
			displayOrder: 1,
		});
	});

	test("lista e busca no projeto do cwd ou no projeto explícito", () => {
		expect(result.featureSearch).toMatchObject({ exitCode: 0, stderr: "" });
		expect(result.featureSearch.stdout).toContain("Nova Área");
		expect(result.featureSearch.stdout).not.toContain("Planejamento");
		expect(result.featureByProject).toMatchObject({ exitCode: 0, stderr: "" });
		expect(result.featureByProject.stdout).toContain("Planejamento");
		expect(result.featureByProject.stdout).not.toContain("Nova Área");
	});

	test("recusa criar uma feature duplicada", () => {
		expect(result.duplicateFeatureCreate.exitCode).toBe(1);
		expect(result.duplicateFeatureCreate.stderr).toContain(
			`A feature "Nova Área" já existe neste projeto: ${result.createdFeature?.id}`,
		);
	});

	test("cria tarefa vinculada sob o path v2 da feature", () => {
		if (!result.createdFeature) {
			throw new Error("Feature criada não retornada pelo cenário");
		}

		expect(result.taskCreate).toMatchObject({ exitCode: 0, stderr: "" });
		expect(result.createdTask).toEqual({
			groupId: result.createdFeature.id,
			folderPath: expect.stringMatching(
				/^\.koworker\/tasks\/nova-area--[0-9a-f]{8}\/minha-tarefa--[0-9a-f]{8}$/,
			),
			indexExists: true,
		});
	});

	test("exige feature em toda tarefa criada pela CLI", () => {
		expect(result.taskWithoutFeature.exitCode).toBe(1);
		expect(result.taskWithoutFeature.stderr).toContain(
			"Toda tarefa criada pela CLI precisa de uma feature",
		);
	});

	test("recusa nome de feature ambíguo e pede o id", () => {
		expect(result.ambiguousTaskCreate.exitCode).toBe(1);
		expect(result.ambiguousTaskCreate.stderr).toContain("Feature ambígua neste projeto: duplicada");
		expect(result.ambiguousTaskCreate.stderr).toContain(
			"cccccccc-0000-4000-8000-000000000031, dddddddd-0000-4000-8000-000000000031",
		);
	});
});
