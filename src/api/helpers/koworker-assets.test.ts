import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listMediaFiles, saveMediaFile } from "./koworker-assets";

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
