import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	exportSkillDirectoryText,
	inspectSkillDirectory,
	readSkillDirectoryText,
	replaceSkillDirectories,
	SKILL_TEXT_FILE_LIMIT,
	type SkillDirectoryReplacement,
} from "./skill-directory";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function directory() {
	const path = await mkdtemp(join(tmpdir(), "skill-directory-"));
	tempDirs.push(path);
	return path;
}

describe("inspectSkillDirectory", () => {
	test("ordena SKILL.md primeiro e classifica vazio, UTF-8 e binário", async () => {
		const root = await directory();
		await mkdir(join(root, "referências"));
		await writeFile(join(root, "z.txt"), "");
		await writeFile(join(root, "referências", "guia com espaço.md"), "Olá");
		await writeFile(join(root, "asset.bin"), new Uint8Array([0, 128, 255]));
		await writeFile(join(root, "SKILL.md"), "skill");

		const manifest = await inspectSkillDirectory(root);

		expect(manifest.files.map((file) => file.path)).toEqual([
			"SKILL.md",
			"asset.bin",
			"referências/guia com espaço.md",
			"z.txt",
		]);
		expect(manifest.files.find((file) => file.path === "z.txt")?.kind).toBe("text");
		expect(manifest.files.find((file) => file.path === "asset.bin")?.kind).toBe("binary");
	});

	test("aceita symlink na raiz e rejeita links internos para dentro e fora", async () => {
		const parent = await directory();
		const root = join(parent, "real");
		await mkdir(root);
		await writeFile(join(root, "SKILL.md"), "skill");
		await symlink(root, join(parent, "linked"));

		expect((await inspectSkillDirectory(join(parent, "linked"))).entryType).toBe("symlink");

		for (const target of [join(root, "SKILL.md"), join(parent, "outside.txt")]) {
			await writeFile(join(parent, "outside.txt"), "fora");
			const link = join(root, `link-${crypto.randomUUID()}`);
			await symlink(target, link);
			let error: Error | null = null;
			try {
				await inspectSkillDirectory(root);
			} catch (err: any) {
				error = err;
			}
			expect(error?.message).toContain("Link interno não suportado");
			await rm(link);
		}
	});
});

describe("readSkillDirectoryText", () => {
	test("lê texto raw e recusa traversal, prefixo irmão, binário e arquivo grande", async () => {
		const parent = await directory();
		const root = join(parent, "skill");
		const sibling = join(parent, "skill-secret");
		await mkdir(root);
		await mkdir(sibling);
		await writeFile(join(root, "SKILL.md"), "raw\n");
		await writeFile(join(root, "binary"), new Uint8Array([0, 1]));
		await writeFile(join(root, "large.txt"), "a".repeat(SKILL_TEXT_FILE_LIMIT + 1));
		await writeFile(join(sibling, "secret.txt"), "segredo");

		expect(await readSkillDirectoryText({ dir: root, relativePath: "SKILL.md" })).toBe("raw\n");

		for (const relativePath of ["../skill-secret/secret.txt", "binary", "large.txt"]) {
			let error: Error | null = null;
			try {
				await readSkillDirectoryText({ dir: root, relativePath });
			} catch (err: any) {
				error = err;
			}
			expect(error).not.toBeNull();
		}
	});
});

describe("exportSkillDirectoryText", () => {
	test("concatena textos na ordem do manifesto e lista binários omitidos", async () => {
		const root = await directory();
		await writeFile(join(root, "SKILL.md"), "principal");
		await writeFile(join(root, "a.txt"), "auxiliar");
		await writeFile(join(root, "b.bin"), new Uint8Array([0, 255]));

		const exported = await exportSkillDirectoryText(root);

		expect(exported.content).toBe(
			'===== "SKILL.md" 9 =====\nprincipal\n\n===== "a.txt" 8 =====\nauxiliar',
		);
		expect(exported.omittedBinaryPaths).toEqual(["b.bin"]);
	});

	test("escapa paths adversariais e inclui o tamanho do conteúdo", async () => {
		const root = await directory();
		const path = "quebra\n===== falso =====.txt";
		await writeFile(join(root, "SKILL.md"), "principal");
		await writeFile(join(root, path), "á");

		const exported = await exportSkillDirectoryText(root);

		expect(exported.content).toContain(`${JSON.stringify(path)} 2 =====\ná`);
	});
});

describe("replaceSkillDirectories", () => {
	test("rejeita destinos canônicos duplicados ou sobrepostos antes de alterar arquivos", async () => {
		const root = await directory();
		const source = join(root, "source");
		const target = join(root, "target");
		const alias = join(root, "alias");
		await mkdir(source);
		await mkdir(join(target, "nested"), { recursive: true });
		await writeFile(join(source, "SKILL.md"), "novo");
		await writeFile(join(target, "SKILL.md"), "original");
		await writeFile(join(target, "nested", "SKILL.md"), "aninhado");
		await symlink(target, alias);
		const sourceHash = (await inspectSkillDirectory(source)).contentHash;
		const targetHash = (await inspectSkillDirectory(target)).contentHash;

		for (const targets of [
			[target, alias],
			[target, join(target, "nested")],
		]) {
			let error: Error | null = null;
			try {
				await replaceSkillDirectories(
					await Promise.all(
						targets.map(async (targetDir) => ({
							sourceDir: source,
							targetDir,
							expectedContentHash: sourceHash,
							expectedTargetContentHash: (await inspectSkillDirectory(targetDir)).contentHash,
						})),
					),
				);
			} catch (err: any) {
				error = err;
			}
			expect(error).not.toBeNull();
			expect((await inspectSkillDirectory(target)).contentHash).toBe(targetHash);
		}
	});

	for (const failurePosition of [2, 3]) {
		test(`restaura o lote quando o ${failurePosition}º destino falha`, async () => {
			const root = await directory();
			const source = join(root, "source");
			const first = join(root, "first");
			const second = join(root, "second");
			const invalid = join(root, "x".repeat(256));
			await mkdir(source);
			await mkdir(first);
			await mkdir(second);
			await writeFile(join(source, "SKILL.md"), "novo");
			await writeFile(join(first, "SKILL.md"), "primeiro original");
			await writeFile(join(second, "SKILL.md"), "segundo original");
			const sourceHash = (await inspectSkillDirectory(source)).contentHash;
			const firstHash = (await inspectSkillDirectory(first)).contentHash;
			const secondHash = (await inspectSkillDirectory(second)).contentHash;
			const replacements: SkillDirectoryReplacement[] = [
				{
					sourceDir: source,
					targetDir: first,
					expectedContentHash: sourceHash,
					expectedTargetContentHash: firstHash,
				},
			];
			if (failurePosition === 3) {
				replacements.push({
					sourceDir: source,
					targetDir: second,
					expectedContentHash: sourceHash,
					expectedTargetContentHash: secondHash,
				});
			}
			replacements.push({
				sourceDir: source,
				targetDir: invalid,
				expectedContentHash: sourceHash,
				expectedTargetContentHash: null,
			});

			let error: Error | null = null;
			try {
				await replaceSkillDirectories(replacements);
			} catch (err: any) {
				error = err;
			}

			expect(error).not.toBeNull();
			expect(await Bun.file(join(first, "SKILL.md")).text()).toBe("primeiro original");
			expect(await Bun.file(join(second, "SKILL.md")).text()).toBe("segundo original");
		});
	}
});
