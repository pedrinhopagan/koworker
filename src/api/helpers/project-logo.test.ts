import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { resolveProjectLogo, resolveProjectLogoByName } from "./project-logo";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createProject(name = "project") {
	const parent = await mkdtemp(join(tmpdir(), "koworker-project-logo-"));
	const root = join(parent, name);
	roots.push(parent);
	await mkdir(root);
	return root;
}

describe("resolveProjectLogo", () => {
	test("prefere a logo principal ao favicon", async () => {
		const root = await createProject();
		await mkdir(join(root, "public", "brand"), { recursive: true });
		await writeFile(join(root, "public", "favicon.svg"), "favicon");
		await writeFile(join(root, "public", "brand", "logo.svg"), "logo");

		expect(await resolveProjectLogo(root)).toBe(join(root, "public", "brand", "logo.svg"));
	});

	test("usa a escolha curada para projetos conhecidos", async () => {
		const root = await createProject("dogama-app");
		await mkdir(join(root, "apps", "front", "public", "icons"), { recursive: true });
		await writeFile(join(root, "apps", "front", "public", "favicon.svg"), "favicon");
		await writeFile(join(root, "apps", "front", "public", "icons", "icon-512.png"), "logo");

		expect(await resolveProjectLogo(root)).toBe(
			join(root, "apps", "front", "public", "icons", "icon-512.png"),
		);
	});

	test("usa a logo da Dogama também no Dogama Vault", () => {
		expect(
			resolveProjectLogoByName("Dogama Vault")?.endsWith("static/project-logos/dogama.png"),
		).toBe(true);
	});

	test("ignora dependências e retorna null quando o projeto não tem identidade visual", async () => {
		const root = await createProject();
		await mkdir(join(root, "node_modules", "package"), { recursive: true });
		await writeFile(join(root, "node_modules", "package", "logo.svg"), "third party");

		expect(await resolveProjectLogo(root)).toBeNull();
	});
});
