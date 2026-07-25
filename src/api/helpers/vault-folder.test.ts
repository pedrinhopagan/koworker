import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	deleteVaultFile,
	getVaultFile,
	listVaultFiles,
	renameVaultFile,
	vaultFolderExists,
	writeVaultFile,
} from "./vault-folder";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

async function createProjectRoot() {
	const root = await mkdtemp(join(tmpdir(), "koworker-vault-"));
	temporaryRoots.push(root);
	await mkdir(join(root, ".koworker"));

	return root;
}

async function createOutsideFile(content: string) {
	const outside = await mkdtemp(join(tmpdir(), "koworker-outside-"));
	temporaryRoots.push(outside);
	const path = join(outside, "segredo.md");
	await writeFile(path, content);

	return path;
}

describe("contenção de path do vault", () => {
	test("não lê arquivo através de link simbólico para fora do projeto", async () => {
		const root = await createProjectRoot();
		const secret = await createOutsideFile("# conteúdo confidencial\n");
		await symlink(secret, join(root, ".koworker", "vazamento.md"));

		expect(await getVaultFile({ projectRoute: root, name: "vazamento.md" })).toBeNull();
	});

	test("não escreve através de link simbólico para fora do projeto", async () => {
		const root = await createProjectRoot();
		const secret = await createOutsideFile("original\n");
		await symlink(secret, join(root, ".koworker", "alvo.md"));

		await expect(
			writeVaultFile({ projectRoute: root, name: "alvo.md", content: "sobrescrito" }),
		).rejects.toThrow();

		expect(await Bun.file(secret).text()).toBe("original\n");
	});

	test("não apaga o destino de um link simbólico", async () => {
		const root = await createProjectRoot();
		const secret = await createOutsideFile("preservar\n");
		await symlink(secret, join(root, ".koworker", "alvo.md"));

		await deleteVaultFile({ projectRoute: root, name: "alvo.md" });

		expect(await Bun.file(secret).exists()).toBe(true);
	});

	test("não renomeia a partir de um link simbólico", async () => {
		const root = await createProjectRoot();
		const secret = await createOutsideFile("preservar\n");
		await symlink(secret, join(root, ".koworker", "alvo.md"));

		await expect(
			renameVaultFile({ projectRoute: root, oldName: "alvo.md", newName: "novo.md" }),
		).rejects.toThrow();

		expect(await Bun.file(secret).exists()).toBe(true);
	});

	test("não lista arquivos quando .koworker é um link simbólico", async () => {
		const outside = await mkdtemp(join(tmpdir(), "koworker-fake-vault-"));
		temporaryRoots.push(outside);
		await writeFile(join(outside, "nota.md"), "# nota\n");

		const root = await mkdtemp(join(tmpdir(), "koworker-vault-"));
		temporaryRoots.push(root);
		await symlink(outside, join(root, ".koworker"));

		expect(await listVaultFiles(root)).toEqual([]);
	});

	test("não adota pasta que é link simbólico", async () => {
		const root = await createProjectRoot();
		const outside = await mkdtemp(join(tmpdir(), "koworker-outside-dir-"));
		temporaryRoots.push(outside);
		await symlink(outside, join(root, ".koworker", "pasta-forjada"));

		expect(await vaultFolderExists({ projectRoute: root, folderName: "pasta-forjada" })).toBe(
			false,
		);
	});

	test("recusa nome com travessia de diretório", async () => {
		const root = await createProjectRoot();

		await expect(
			writeVaultFile({ projectRoute: root, name: "../fora.md", content: "x" }),
		).rejects.toThrow();
	});
});

describe("operações legítimas do vault", () => {
	test("escreve, lê e renomeia uma nota comum", async () => {
		const root = await createProjectRoot();

		await writeVaultFile({ projectRoute: root, name: "nota.md", content: "# Minha nota\n" });

		const file = await getVaultFile({ projectRoute: root, name: "nota.md" });
		expect(file?.title).toBe("Minha nota");

		await renameVaultFile({ projectRoute: root, oldName: "nota.md", newName: "outra.md" });

		expect(await getVaultFile({ projectRoute: root, name: "nota.md" })).toBeNull();
		expect((await getVaultFile({ projectRoute: root, name: "outra.md" }))?.title).toBe(
			"Minha nota",
		);
	});
});
