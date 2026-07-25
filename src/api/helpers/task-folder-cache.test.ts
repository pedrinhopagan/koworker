import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invalidateFolderPrefix } from "./folder-cache";
import { readFirstMarkdownContent, readTaskFolderMeta, writeTaskFile } from "./task-folder";
import { resolveExistingTaskFolder } from "./task-storage-path";

let testRoot: string;
let projectRoute: string;

const primeira = ".koworker/tasks/feature--0123abcd/primeira--00112233";
const segunda = ".koworker/tasks/feature--0123abcd/segunda--44556677";

async function seedTask(folderPath: string, fileName: string, content: string) {
	const dir = join(projectRoute, folderPath);
	await mkdir(dir, { recursive: true });
	await Bun.write(join(dir, fileName), content);

	return dir;
}

beforeEach(async () => {
	testRoot = await mkdtemp(join(tmpdir(), "task-folder-cache-"));
	projectRoute = join(testRoot, "projeto");
	await mkdir(join(projectRoute, ".koworker"), { recursive: true });
});

afterEach(async () => {
	await rm(testRoot, { recursive: true, force: true });
});

describe("cache de metadados da pasta da tarefa", () => {
	test("separa tarefas diferentes do mesmo projeto pela chave lógica", async () => {
		await seedTask(primeira, "index.md", "# primeira");
		await seedTask(segunda, "index.md", "# segunda");

		expect((await readTaskFolderMeta({ projectRoute, folderPath: primeira })).fileNames).toEqual([
			"index.md",
		]);
		expect(await readFirstMarkdownContent({ projectRoute, folderPath: segunda })).toBe("# segunda");
		expect(await readFirstMarkdownContent({ projectRoute, folderPath: primeira })).toBe(
			"# primeira",
		);
	});

	test("invalida pelo diretório resolvido quando o watcher avisa", async () => {
		const dir = await seedTask(primeira, "index.md", "# antes");

		expect(await readFirstMarkdownContent({ projectRoute, folderPath: primeira })).toBe("# antes");

		await Bun.write(join(dir, "index.md"), "# depois");
		expect(await readFirstMarkdownContent({ projectRoute, folderPath: primeira })).toBe("# antes");

		invalidateFolderPrefix(dir);

		expect(await readFirstMarkdownContent({ projectRoute, folderPath: primeira })).toBe("# depois");
		expect((await readTaskFolderMeta({ projectRoute, folderPath: primeira })).fileNames).toEqual([
			"index.md",
		]);
	});

	test("enxerga arquivo novo escrito pela api sem esperar o TTL", async () => {
		await seedTask(primeira, "index.md", "# tarefa");

		expect((await readTaskFolderMeta({ projectRoute, folderPath: primeira })).fileNames).toEqual([
			"index.md",
		]);

		await writeTaskFile({
			projectRoute,
			folderPath: primeira,
			name: "plano.md",
			content: "# plano",
		});

		expect((await readTaskFolderMeta({ projectRoute, folderPath: primeira })).fileNames).toEqual([
			"index.md",
			"plano.md",
		]);
	});

	test("não cacheia pasta ausente: passa a listar assim que ela é criada", async () => {
		expect((await readTaskFolderMeta({ projectRoute, folderPath: primeira })).fileNames).toEqual(
			[],
		);

		await seedTask(primeira, "index.md", "# nasceu agora");

		expect((await readTaskFolderMeta({ projectRoute, folderPath: primeira })).fileNames).toEqual([
			"index.md",
		]);
	});
});

describe("cache da raiz .koworker", () => {
	test("continua recusando pasta de tarefa removida depois do primeiro resolve", async () => {
		const dir = await seedTask(primeira, "index.md", "# tarefa");

		expect(await resolveExistingTaskFolder({ projectRoute, folderPath: primeira })).toBe(dir);

		await rm(dir, { recursive: true, force: true });

		await expect(resolveExistingTaskFolder({ projectRoute, folderPath: primeira })).rejects.toThrow(
			"Pasta da tarefa ausente ou insegura",
		);
	});

	test("não guarda raiz inválida: resolve assim que o .koworker aparece", async () => {
		const outro = join(testRoot, "outro");
		await mkdir(outro, { recursive: true });

		await expect(
			resolveExistingTaskFolder({ projectRoute: outro, folderPath: primeira }),
		).rejects.toThrow("Diretório .koworker inválido");

		const dir = join(outro, primeira);
		await mkdir(dir, { recursive: true });
		await Bun.write(join(dir, "index.md"), "# tarefa");

		expect(await resolveExistingTaskFolder({ projectRoute: outro, folderPath: primeira })).toBe(
			dir,
		);
	});
});
