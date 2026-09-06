import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FILE_VIEW_TEXT_MAX_BYTES, readViewableFile } from "./file-view";

let root: string;
let outside: string;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "kw-file-view-"));
	outside = await mkdtemp(join(tmpdir(), "kw-file-view-outside-"));
	await writeFile(join(root, "notas.md"), "# Título\n");
	await writeFile(join(root, "bin.dat"), Buffer.from([0x89, 0x50, 0x00, 0x47]));
	await writeFile(join(root, "grande.txt"), "x".repeat(FILE_VIEW_TEXT_MAX_BYTES + 10));
	await writeFile(join(root, "img.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
	await writeFile(join(outside, "segredo.txt"), "fora");
	await symlink(join(outside, "segredo.txt"), join(root, "atalho.txt"));
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
	await rm(outside, { recursive: true, force: true });
});

describe("readViewableFile", () => {
	test("lê texto dentro de uma raiz permitida", async () => {
		const file = await readViewableFile(join(root, "notas.md"), [root]);
		expect(file.kind).toBe("text");
		if (file.kind === "text") {
			expect(file.content).toBe("# Título\n");
			expect(file.truncated).toBe(false);
			expect(file.name).toBe("notas.md");
		}
	});

	test("corta arquivo acima do limite e avisa", async () => {
		const file = await readViewableFile(join(root, "grande.txt"), [root]);
		if (file.kind !== "text") throw new Error("esperava texto");
		expect(file.truncated).toBe(true);
		expect(file.content.length).toBe(FILE_VIEW_TEXT_MAX_BYTES);
	});

	test("devolve imagem como data URL", async () => {
		const file = await readViewableFile(join(root, "img.png"), [root]);
		expect(file.kind).toBe("image");
		if (file.kind === "image") {
			expect(file.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
		}
	});

	test("recusa binário, caminho fora das raízes, symlink para fora e inexistente", async () => {
		await expect(readViewableFile(join(root, "bin.dat"), [root])).rejects.toMatchObject({
			code: "UNPROCESSABLE_CONTENT",
		});
		await expect(readViewableFile(join(outside, "segredo.txt"), [root])).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		await expect(readViewableFile(join(root, "atalho.txt"), [root])).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		await expect(readViewableFile(join(root, "nada.txt"), [root])).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});
