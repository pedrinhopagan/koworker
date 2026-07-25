import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listProjectDocs, readProjectDoc, writeProjectDoc } from "./project-docs";

let testRoot: string;
let projectRoute: string;

beforeEach(async () => {
	testRoot = await mkdtemp(join(tmpdir(), "project-docs-"));
	projectRoute = join(testRoot, "project");
	await mkdir(projectRoute);
});

afterEach(async () => {
	await rm(testRoot, { recursive: true, force: true });
});

describe("listProjectDocs", () => {
	test("lista somente metadados dos documentos reconhecidos", async () => {
		await mkdir(join(projectRoute, "apps", "web"), { recursive: true });
		await Bun.write(join(projectRoute, "README.md"), "raiz");
		await Bun.write(join(projectRoute, "apps", "web", "AGENTS.md"), "web");
		await Bun.write(join(projectRoute, "NOTES.md"), "ignorado");

		const docs = await listProjectDocs(projectRoute);

		expect(docs).toEqual([
			{ path: "apps/web/AGENTS.md", name: "AGENTS.md", dirLabel: "/apps/web/" },
			{ path: "README.md", name: "README.md", dirLabel: "/" },
		]);
		expect(docs.some((doc) => "content" in doc)).toBe(false);
	});

	test("para na profundidade máxima em vez de varrer a árvore inteira", async () => {
		const raso = join(projectRoute, "a", "b", "c", "d");
		const fundo = join(raso, "e");
		await mkdir(fundo, { recursive: true });
		await Bun.write(join(raso, "AGENTS.md"), "no limite");
		await Bun.write(join(fundo, "AGENTS.md"), "fundo demais");

		const docs = await listProjectDocs(projectRoute);

		expect(docs.map((doc) => doc.path)).toEqual(["a/b/c/d/AGENTS.md"]);
	});

	test("serve o cache e revalida depois de uma escrita", async () => {
		await Bun.write(join(projectRoute, "README.md"), "raiz");

		expect((await listProjectDocs(projectRoute)).map((doc) => doc.path)).toEqual(["README.md"]);

		await Bun.write(join(projectRoute, "AGENTS.md"), "direto no disco");
		expect((await listProjectDocs(projectRoute)).map((doc) => doc.path)).toEqual(["README.md"]);

		await writeProjectDoc({ projectRoute, path: "CONTRIBUTING.md", content: "pela api" });

		expect((await listProjectDocs(projectRoute)).map((doc) => doc.path)).toEqual([
			"AGENTS.md",
			"CONTRIBUTING.md",
			"README.md",
		]);
	});

	test("ignora pastas ocultas e diretórios de build ou dependências", async () => {
		for (const dir of [".git", ".koworker", "node_modules", "dist", "coverage"]) {
			await mkdir(join(projectRoute, dir), { recursive: true });
			await Bun.write(join(projectRoute, dir, "README.md"), dir);
		}
		await Bun.write(join(projectRoute, "AGENTS.md"), "visível");

		const docs = await listProjectDocs(projectRoute);

		expect(docs).toEqual([{ path: "AGENTS.md", name: "AGENTS.md", dirLabel: "/" }]);
	});
});

describe("readProjectDoc", () => {
	test("lê somente o documento solicitado", async () => {
		await mkdir(join(projectRoute, "apps"));
		await Bun.write(join(projectRoute, "README.md"), "raiz");
		await Bun.write(join(projectRoute, "apps", "CLAUDE.md"), "conteúdo pontual");

		const doc = await readProjectDoc(projectRoute, "apps/CLAUDE.md");

		expect(doc).toEqual({
			path: "apps/CLAUDE.md",
			name: "CLAUDE.md",
			dirLabel: "/apps/",
			content: "conteúdo pontual",
		});
	});

	test("recusa arquivo ausente, nome fora da whitelist e traversal", async () => {
		await Bun.write(join(testRoot, "README.md"), "fora");

		const missing = await readProjectDoc(projectRoute, "README.md");
		const unknown = await readProjectDoc(projectRoute, "NOTES.md");
		const traversal = await readProjectDoc(projectRoute, "../README.md");

		expect(missing).toBeNull();
		expect(unknown).toBeNull();
		expect(traversal).toBeNull();
	});

	test("não segue symlink para fora da raiz", async () => {
		const outside = join(testRoot, "outside");
		await mkdir(outside);
		await Bun.write(join(outside, "README.md"), "fora");
		await symlink(outside, join(projectRoute, "linked"));

		const doc = await readProjectDoc(projectRoute, "linked/README.md");

		expect(doc).toBeNull();
	});
});

describe("writeProjectDoc", () => {
	test("sobrescreve documento reconhecido dentro da raiz", async () => {
		await Bun.write(join(projectRoute, "README.md"), "antes");

		await writeProjectDoc({ projectRoute, path: "README.md", content: "depois" });
		const doc = await readProjectDoc(projectRoute, "README.md");

		expect(doc?.content).toBe("depois");
	});

	test("recusa nome fora da whitelist, traversal e symlink externo", async () => {
		const outside = join(testRoot, "outside");
		await mkdir(outside);
		await Bun.write(join(testRoot, "README.md"), "fora");
		await Bun.write(join(outside, "README.md"), "fora");
		await symlink(outside, join(projectRoute, "linked"));

		expect(() => writeProjectDoc({ projectRoute, path: "NOTES.md", content: "x" })).toThrow(
			"não é um documento principal reconhecido",
		);
		expect(() => writeProjectDoc({ projectRoute, path: "../README.md", content: "x" })).toThrow(
			"Caminho fora do projeto",
		);
		expect(() => writeProjectDoc({ projectRoute, path: "linked/README.md", content: "x" })).toThrow(
			"Caminho fora do projeto",
		);
	});
});
