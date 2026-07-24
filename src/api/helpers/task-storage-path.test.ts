import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	allocateStorageKey,
	buildExpectedTaskFolderPath,
	extractStorageKey,
	normalizeStorageSlug,
	resolveExistingTaskFolder,
	resolveTaskFolderDestination,
} from "./task-storage-path";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

async function createProjectRoot() {
	const root = await mkdtemp(join(tmpdir(), "koworker-task-storage-path-"));
	temporaryRoots.push(root);
	await mkdir(join(root, ".koworker"));

	return root;
}

describe("normalizeStorageSlug", () => {
	test("normaliza diacríticos, separadores e tamanho", () => {
		expect(normalizeStorageSlug("  Árvore -- de Decisões!!!  ", "tarefa")).toBe(
			"arvore-de-decisoes",
		);
		expect(normalizeStorageSlug("a".repeat(60), "feature")).toHaveLength(48);
	});

	test("usa fallback quando o nome não produz slug", () => {
		expect(normalizeStorageSlug("🔒", "feature")).toBe("feature");
		expect(normalizeStorageSlug(undefined, "tarefa")).toBe("tarefa");
	});
});

describe("allocateStorageKey", () => {
	test("começa em oito caracteres e cresce em blocos de quatro", () => {
		const first = allocateStorageKey({
			id: "12345678-aaaa-4000-8000-000000000001",
			usedKeys: new Set(),
		});
		const second = allocateStorageKey({
			id: "12345678-bbbb-4000-8000-000000000002",
			usedKeys: new Set([first]),
		});

		expect(first).toBe("12345678");
		expect(second).toBe("12345678bbbb");
	});
});

describe("buildExpectedTaskFolderPath", () => {
	test("mantém layout v1 flat e produz layout v2 canônico", () => {
		const taskId = "12345678-aaaa-4000-8000-000000000001";

		expect(
			buildExpectedTaskFolderPath({
				layoutVersion: 1,
				taskId,
				taskStorageKey: "12345678",
				taskStorageSlug: "minha-tarefa",
			}),
		).toBe(".koworker/12345678");
		expect(
			buildExpectedTaskFolderPath({
				layoutVersion: 2,
				taskId,
				taskStorageKey: "12345678",
				taskStorageSlug: "minha-tarefa",
				featureStorageKey: "abcdef12",
				featureStorageSlug: "tarefas",
			}),
		).toBe(".koworker/tasks/tarefas--abcdef12/minha-tarefa--12345678");
		expect(
			buildExpectedTaskFolderPath({
				layoutVersion: 2,
				taskId,
				taskStorageKey: "12345678",
				taskStorageSlug: "minha-tarefa",
			}),
		).toBe(".koworker/tasks/_sem-feature/minha-tarefa--12345678");
	});

	test("extrai somente chaves canônicas", () => {
		expect(extractStorageKey("minha-tarefa--12345678abcd")).toBe("12345678abcd");
		expect(extractStorageKey("minha-tarefa-12345678")).toBeUndefined();
	});
});

describe("confinamento", () => {
	test("resolve pasta existente e destino ausente dentro de .koworker", async () => {
		const root = await createProjectRoot();
		await mkdir(join(root, ".koworker", "existente"));

		expect(
			await resolveExistingTaskFolder({
				projectRoute: root,
				folderPath: ".koworker/existente",
			}),
		).toBe(join(root, ".koworker", "existente"));
		expect(
			await resolveTaskFolderDestination({
				projectRoute: root,
				folderPath: ".koworker/tasks/_sem-feature/tarefa--12345678",
			}),
		).toBe(join(root, ".koworker", "tasks", "_sem-feature", "tarefa--12345678"));
	});

	test("recusa travessia e link simbólico", async () => {
		const root = await createProjectRoot();
		const outside = await mkdtemp(join(tmpdir(), "koworker-task-storage-outside-"));
		temporaryRoots.push(outside);
		await symlink(outside, join(root, ".koworker", "linked"));

		let traversalError: unknown;
		try {
			await resolveTaskFolderDestination({
				projectRoute: root,
				folderPath: ".koworker/../fora",
			});
		} catch (error) {
			traversalError = error;
		}

		let symlinkError: unknown;
		try {
			await resolveExistingTaskFolder({
				projectRoute: root,
				folderPath: ".koworker/linked",
			});
		} catch (error) {
			symlinkError = error;
		}

		expect(traversalError).toBeInstanceOf(Error);
		expect(symlinkError).toBeInstanceOf(Error);
	});
});
