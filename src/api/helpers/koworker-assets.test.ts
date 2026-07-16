import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listMediaFiles, listTaskArtifacts, saveMediaFile } from "./koworker-assets";

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
