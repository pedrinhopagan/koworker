import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, symlink, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";

import {
	deleteMediaFile,
	invalidateMediaFilesCache,
	listMediaFiles,
	listTaskArtifacts,
	listTaskMediaFiles,
	readMediaPreview,
	readTaskMediaFile,
	readTaskMediaPreview,
	renameMediaFile,
	saveMediaFile,
} from "./koworker-assets";
import { invalidateFolderPrefix } from "./folder-cache";

let projectRoute: string;

beforeEach(async () => {
	projectRoute = await mkdtemp(join(tmpdir(), "koworker-assets-"));
});

afterEach(async () => {
	await rm(projectRoute, { recursive: true, force: true });
});

function pngFile(): File {
	return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "clipboard", {
		type: "image/png",
	});
}

describe("saveMediaFile", () => {
	test("grava a imagem em .koworker/medias/ e devolve a meta confirmada pelo disco", async () => {
		const meta = await saveMediaFile({ projectRoute, file: pngFile() });

		expect(meta.name).toMatch(/^imagem-\d{4}-\d{2}-\d{2}-\d{6}\.png$/);
		expect(meta.mime).toBe("image/png");
		expect(meta.size).toBe(4);

		const listed = await listMediaFiles(projectRoute);
		expect(listed.map((entry) => entry.name)).toEqual([meta.name]);
	});

	test("colisão de nome no mesmo segundo ganha sufixo numérico", async () => {
		const first = await saveMediaFile({ projectRoute, file: pngFile() });
		const second = await saveMediaFile({ projectRoute, file: pngFile() });
		const third = await saveMediaFile({ projectRoute, file: pngFile() });

		expect(second.name).not.toBe(first.name);
		expect(third.name).not.toBe(second.name);
		// Mesmo segundo → mesmo base; os seguintes derivam dele com `-2`, `-3`.
		if (second.name.startsWith(first.name.replace(".png", ""))) {
			expect(second.name).toBe(first.name.replace(".png", "-2.png"));
			expect(third.name).toBe(first.name.replace(".png", "-3.png"));
		}
	});

	test("MIME fora da whitelist de imagens é recusado", async () => {
		const pdf = new File([new Uint8Array([1])], "doc", { type: "application/pdf" });

		await expect(saveMediaFile({ projectRoute, file: pdf })).rejects.toThrow(
			"Tipo de imagem não suportado",
		);
	});

	test("invalida a listagem ao salvar, renomear e excluir", async () => {
		const dir = join(projectRoute, ".koworker", "medias");
		await mkdir(dir, { recursive: true });
		await Bun.write(join(dir, "manual.png"), new Uint8Array([1]));

		expect((await listMediaFiles(projectRoute)).map((file) => file.name)).toEqual(["manual.png"]);

		const saved = await saveMediaFile({ projectRoute, file: pngFile() });
		expect((await listMediaFiles(projectRoute)).map((file) => file.name).sort()).toEqual(
			["manual.png", saved.name].sort(),
		);

		await renameMediaFile({ projectRoute, oldName: "manual.png", newName: "renamed.png" });
		expect((await listMediaFiles(projectRoute)).map((file) => file.name).sort()).toEqual(
			["renamed.png", saved.name].sort(),
		);

		await deleteMediaFile({ projectRoute, name: "renamed.png" });
		expect((await listMediaFiles(projectRoute)).map((file) => file.name)).toEqual([saved.name]);
	});
});

describe("task media", () => {
	test("lista e lê somente imagens diretamente na pasta da tarefa", async () => {
		const folderPath = ".koworker/task-media";
		const taskDir = join(projectRoute, folderPath);
		await mkdir(join(taskDir, "nested"), { recursive: true });
		await Bun.write(join(taskDir, "captura.png"), new Uint8Array([1, 2, 3]));
		await Bun.write(join(taskDir, "foto.JPG"), new Uint8Array([4, 5]));
		await Bun.write(join(taskDir, "index.md"), "# Tarefa");
		await Bun.write(join(taskDir, "relatorio.pdf"), new Uint8Array([6]));
		await Bun.write(join(taskDir, "nested", "oculta.png"), new Uint8Array([7]));

		const files = await listTaskMediaFiles({ projectRoute, folderPath });
		const image = await readTaskMediaFile({
			projectRoute,
			folderPath,
			name: "captura.png",
		});

		expect(files.map((file) => file.name).sort()).toEqual(["captura.png", "foto.JPG"]);
		expect(image?.type).toBe("image/png");
		expect(await image?.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
	});

	test("não lê uma imagem apontada por link simbólico", async () => {
		const folderPath = ".koworker/task-media";
		const taskDir = join(projectRoute, folderPath);
		const outside = join(projectRoute, "outside.png");
		await mkdir(taskDir, { recursive: true });
		await Bun.write(outside, new Uint8Array([1, 2, 3]));
		await symlink(outside, join(taskDir, "linked.png"));

		const image = await readTaskMediaFile({
			projectRoute,
			folderPath,
			name: "linked.png",
		});

		expect(image).toBeNull();
	});

	test("não lista nem lê uma pasta de tarefa apontada para fora de .koworker", async () => {
		const folderPath = ".koworker/task-linked";
		const outside = join(projectRoute, "outside-task");
		await mkdir(join(projectRoute, ".koworker"), { recursive: true });
		await mkdir(outside);
		await Bun.write(join(outside, "secret.png"), new Uint8Array([1, 2, 3]));
		await symlink(outside, join(projectRoute, folderPath));

		const files = await listTaskMediaFiles({ projectRoute, folderPath });
		const image = await readTaskMediaFile({
			projectRoute,
			folderPath,
			name: "secret.png",
		});

		expect(files).toEqual([]);
		expect(image).toBeNull();
	});

	test("preserva a listagem em eventos não-imagem e invalida em eventos de imagem", async () => {
		const folderPath = ".koworker/task-cache";
		const dir = join(projectRoute, folderPath);
		await mkdir(dir, { recursive: true });
		await Bun.write(join(dir, "first.png"), new Uint8Array([1]));

		expect(
			(await listTaskMediaFiles({ projectRoute, folderPath })).map((file) => file.name),
		).toEqual(["first.png"]);

		await Bun.write(join(dir, "index.md"), "# Alterada");
		invalidateFolderPrefix(dir);
		expect(
			(await listTaskMediaFiles({ projectRoute, folderPath })).map((file) => file.name),
		).toEqual(["first.png"]);

		await Bun.write(join(dir, "second.png"), new Uint8Array([2]));
		invalidateFolderPrefix(dir);
		expect(
			(await listTaskMediaFiles({ projectRoute, folderPath })).map((file) => file.name),
		).toEqual(["first.png"]);

		invalidateMediaFilesCache(dir);
		expect(
			(await listTaskMediaFiles({ projectRoute, folderPath })).map((file) => file.name).sort(),
		).toEqual(["first.png", "second.png"]);
	});
});

describe("media previews", () => {
	test("gera WebP 480x360 ancorado no topo para mídia avulsa", async () => {
		const dir = join(projectRoute, ".koworker", "medias");
		const path = join(dir, "captura.png");
		const pixels = new Uint8Array(480 * 720 * 3);
		for (let index = 0; index < pixels.length; index += 3) {
			const isTopHalf = index / 3 < 480 * 360;
			pixels[index] = isTopHalf ? 255 : 0;
			pixels[index + 2] = isTopHalf ? 0 : 255;
		}
		await mkdir(dir, { recursive: true });
		await sharp(pixels, { raw: { width: 480, height: 720, channels: 3 } })
			.png()
			.toFile(path);

		const preview = await readMediaPreview({ projectRoute, name: "captura.png" });
		if (!preview) {
			throw new Error("Preview não gerado");
		}
		const bytes = new Uint8Array(await preview.arrayBuffer());
		const metadata = await sharp(bytes).metadata();
		const raw = await sharp(bytes).raw().toBuffer();

		expect(preview.name).toBe("captura.webp");
		expect(preview.type).toBe("image/webp");
		expect(metadata).toMatchObject({ format: "webp", width: 480, height: 360 });
		expect(raw[0]).toBeGreaterThan(240);
		expect(raw[2]).toBeLessThan(15);
	});

	test("gera preview para imagem direta da pasta da tarefa", async () => {
		const folderPath = ".koworker/task-preview";
		const dir = join(projectRoute, folderPath);
		await mkdir(dir, { recursive: true });
		await sharp({
			create: { width: 900, height: 600, channels: 3, background: "#20a060" },
		})
			.jpeg()
			.toFile(join(dir, "tarefa.jpg"));

		const preview = await readTaskMediaPreview({
			projectRoute,
			folderPath,
			name: "tarefa.jpg",
		});
		if (!preview) {
			throw new Error("Preview não gerado");
		}
		const metadata = await sharp(await preview.arrayBuffer()).metadata();

		expect(preview.name).toBe("tarefa.webp");
		expect(preview.type).toBe("image/webp");
		expect(metadata).toMatchObject({ format: "webp", width: 480, height: 360 });
	});

	test("invalida o cache quando o mtime muda", async () => {
		const dir = join(projectRoute, ".koworker", "medias");
		const path = join(dir, "cache.svg");
		const stableTime = new Date(Date.now() - 10_000);
		await mkdir(dir, { recursive: true });
		await Bun.write(
			path,
			'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#ff0000"/></svg>',
		);
		await utimes(path, stableTime, stableTime);

		const first = await readMediaPreview({ projectRoute, name: "cache.svg" });
		if (!first) {
			throw new Error("Preview não gerado");
		}
		const firstBytes = new Uint8Array(await first.arrayBuffer());

		await Bun.write(
			path,
			'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#0000ff"/></svg>',
		);
		await utimes(path, stableTime, stableTime);

		const cached = await readMediaPreview({ projectRoute, name: "cache.svg" });
		if (!cached) {
			throw new Error("Preview não gerado");
		}
		expect(new Uint8Array(await cached.arrayBuffer())).toEqual(firstBytes);

		const changedTime = new Date(stableTime.getTime() + 2_000);
		await utimes(path, changedTime, changedTime);

		const refreshed = await readMediaPreview({ projectRoute, name: "cache.svg" });
		if (!refreshed) {
			throw new Error("Preview não gerado");
		}
		expect(new Uint8Array(await refreshed.arrayBuffer())).not.toEqual(firstBytes);
	});
});

describe("listTaskArtifacts", () => {
	test("lê título, subtítulo e destaques do head do HTML", async () => {
		const taskDir = join(projectRoute, ".koworker", "task-1");
		await mkdir(taskDir, { recursive: true });
		await Bun.write(
			join(taskDir, "galeria.html"),
			`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta content="Fluxo completo &amp; estados aprovados" name="description">
<meta name="koworker:heading" content="Visão desktop clara">
<meta name="koworker:heading" content="Detalhes do estado vazio">
<title>Galeria &amp; revisão</title>
</head>
<body></body>
</html>`,
		);
		await Bun.write(join(taskDir, "documento.pdf"), new Uint8Array([1, 2, 3]));

		const artifacts = await listTaskArtifacts({
			projectRoute,
			folderPath: ".koworker/task-1",
		});
		const html = artifacts.find((artifact) => artifact.name === "galeria.html");
		const pdf = artifacts.find((artifact) => artifact.name === "documento.pdf");

		expect(html?.metadata).toEqual({
			title: "Galeria & revisão",
			subtitle: "Fluxo completo & estados aprovados",
			headings: ["Visão desktop clara", "Detalhes do estado vazio"],
		});
		expect(pdf?.metadata).toBeNull();
	});

	test("mantém HTML antigo sem metadados compatível", async () => {
		const taskDir = join(projectRoute, ".koworker", "task-2");
		await mkdir(taskDir, { recursive: true });
		await Bun.write(
			join(taskDir, "legado.html"),
			"<!doctype html><html><body>Legado</body></html>",
		);

		const artifacts = await listTaskArtifacts({
			projectRoute,
			folderPath: ".koworker/task-2",
		});

		expect(artifacts[0]?.metadata).toBeNull();
	});

	test("reutiliza metadados enquanto mtime e tamanho permanecem iguais", async () => {
		const taskDir = join(projectRoute, ".koworker", "task-cache");
		const artifactPath = join(taskDir, "cache.html");
		await mkdir(taskDir, { recursive: true });
		await Bun.write(artifactPath, "<title>Primeiro</title>");
		const stableTime = new Date(Date.now() - 10_000);
		await utimes(artifactPath, stableTime, stableTime);

		const first = await listTaskArtifacts({
			projectRoute,
			folderPath: ".koworker/task-cache",
		});
		expect(first[0]?.metadata?.title).toBe("Primeiro");

		await Bun.write(artifactPath, "<title>Segundo!</title>");
		await utimes(artifactPath, stableTime, stableTime);

		const cached = await listTaskArtifacts({
			projectRoute,
			folderPath: ".koworker/task-cache",
		});
		expect(cached[0]?.metadata?.title).toBe("Primeiro");

		const changedMtime = new Date(stableTime.getTime() + 2_000);
		await utimes(artifactPath, changedMtime, changedMtime);

		const refreshed = await listTaskArtifacts({
			projectRoute,
			folderPath: ".koworker/task-cache",
		});
		expect(refreshed[0]?.metadata?.title).toBe("Segundo!");
	});

	test("remove do cache uma leitura que falhou", async () => {
		const taskDir = join(projectRoute, ".koworker", "task-retry");
		const artifactPath = join(taskDir, "retry.html");
		await mkdir(taskDir, { recursive: true });
		await Bun.write(artifactPath, "<title>Recuperado</title>");
		await chmod(artifactPath, 0);

		let failure: unknown;
		try {
			await listTaskArtifacts({
				projectRoute,
				folderPath: ".koworker/task-retry",
			});
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(Error);

		await chmod(artifactPath, 0o600);
		const recovered = await listTaskArtifacts({
			projectRoute,
			folderPath: ".koworker/task-retry",
		});

		expect(recovered[0]?.metadata?.title).toBe("Recuperado");
	});
});
