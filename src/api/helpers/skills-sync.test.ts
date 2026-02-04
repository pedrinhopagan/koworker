import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { jsonStringify } from "@/api/helpers/json";
import { readSkillFile, type SkillFile, writeSkillFile } from "@/lib/skills/parser";

const testId = crypto.randomUUID();
const configPath = join("/tmp", `kowork-skill-sync-${testId}`);
const dbPath = join("/tmp", `kowork-skill-sync-${testId}.sqlite`);

let db: any;
let dbSkills: any;
let importSkillsFromConfig: any;
let exportSkillsToConfig: any;
let previewImportFromConfig: any;
let previewExportToConfig: any;

async function createConfigSkill(
	slug: string,
	body: string,
	options: { name?: string; title?: string } = {},
) {
	const skillPath = join(configPath, slug, "SKILL.md");
	await mkdir(join(configPath, slug), { recursive: true });
	const { name, title } = options;
	const frontmatter: SkillFile["frontmatter"] = {
		name: name ?? slug,
		description: `Descricao ${slug}`,
	};
	if (title) {
		frontmatter.title = title;
	}
	const skill: SkillFile = {
		frontmatter,
		body,
	};
	await writeSkillFile(skillPath, skill);
}

async function createDbSkill(slug: string, content: string, options: { title?: string } = {}) {
	const metadata = options.title ? { title: options.title } : {};
	await dbSkills.create({
		id: crypto.randomUUID(),
		slug,
		name: slug,
		description: `Descricao ${slug}`,
		content,
		metadata: jsonStringify(metadata),
		source: "custom",
	});
}

beforeAll(async () => {
	process.env.DATABASE_URL = dbPath;
	process.env.JWT_SECRET = "test";
	process.env.NODE_ENV = "development";

	({ db } = await import("../db/connection"));
	({ dbSkills } = await import("../db/skills"));
	({
		importSkillsFromConfig,
		exportSkillsToConfig,
		previewImportFromConfig,
		previewExportToConfig,
	} = await import("./skills-sync"));
});

beforeEach(async () => {
	await rm(configPath, { recursive: true, force: true });
	await mkdir(configPath, { recursive: true });
	await db.deleteFrom("skills").execute();
});

afterAll(async () => {
	await rm(configPath, { recursive: true, force: true });
	await rm(dbPath, { force: true });
});

describe("skills-sync", () => {
	it("importa respeitando conflitos e selecao", async () => {
		await createConfigSkill("alpha", "conteudo-alpha");
		await createConfigSkill("beta", "conteudo-beta");
		await createDbSkill("alpha", "conteudo-db");

		const ignoreResult = await importSkillsFromConfig({
			configPath,
			conflictStrategy: "ignore",
		});

		expect(ignoreResult).toEqual({ imported: 1, skipped: 1, overwritten: 0 });
		expect((await dbSkills.getBySlug("alpha"))?.content).toBe("conteudo-db");

		const overwriteResult = await importSkillsFromConfig({
			configPath,
			conflictStrategy: "overwrite",
			slugs: ["alpha"],
		});

		expect(overwriteResult).toEqual({ imported: 0, skipped: 0, overwritten: 1 });
		expect((await dbSkills.getBySlug("alpha"))?.content).toBe("conteudo-alpha");
	});

	it("exporta respeitando conflitos e selecao", async () => {
		await createDbSkill("alpha", "conteudo-db");
		await createDbSkill("beta", "conteudo-beta");
		await createConfigSkill("alpha", "conteudo-config");

		const ignoreResult = await exportSkillsToConfig({
			configPath,
			conflictStrategy: "ignore",
		});

		expect(ignoreResult).toEqual({ exported: 1, skipped: 1, overwritten: 0 });
		expect((await readSkillFile(join(configPath, "alpha", "SKILL.md")))?.body).toBe(
			"conteudo-config",
		);

		const overwriteResult = await exportSkillsToConfig({
			configPath,
			conflictStrategy: "overwrite",
			slugs: ["alpha"],
		});

		expect(overwriteResult).toEqual({ exported: 0, skipped: 0, overwritten: 1 });
		expect((await readSkillFile(join(configPath, "alpha", "SKILL.md")))?.body).toBe("conteudo-db");
	});

	it("mostra conflitos no preview", async () => {
		await createConfigSkill("alpha", "conteudo-alpha");
		await createConfigSkill("beta", "conteudo-beta");
		await createDbSkill("alpha", "conteudo-db");
		await createDbSkill("gamma", "conteudo-gamma");

		const importPreview = await previewImportFromConfig({ configPath });
		const importMap = new Map(
			importPreview.map((item: { slug: string; hasConflict: boolean }) => [
				item.slug,
				item.hasConflict,
			]),
		);
		expect(importMap.get("alpha")).toBe(true);
		expect(importMap.get("beta")).toBe(false);

		const exportPreview = await previewExportToConfig({ configPath });
		const exportMap = new Map(
			exportPreview.map((item: { slug: string; hasConflict: boolean }) => [
				item.slug,
				item.hasConflict,
			]),
		);
		expect(exportMap.get("alpha")).toBe(true);
		expect(exportMap.get("gamma")).toBe(false);
	});

	it("mantem name como slug e salva title no metadata", async () => {
		await createConfigSkill("alpha", "conteudo-alpha", {
			name: "Titulo Alpha",
		});

		await importSkillsFromConfig({
			configPath,
			conflictStrategy: "overwrite",
		});

		const imported = await dbSkills.getBySlug("alpha");
		expect(imported?.name).toBe("alpha");
		expect(JSON.parse(imported?.metadata ?? "{}")).toEqual({ title: "Titulo Alpha" });
	});

	it("exporta com name slug e title no frontmatter", async () => {
		await createDbSkill("alpha", "conteudo-db", { title: "Titulo Alpha" });

		await exportSkillsToConfig({
			configPath,
			conflictStrategy: "overwrite",
		});

		const exported = await readSkillFile(join(configPath, "alpha", "SKILL.md"));
		expect(exported?.frontmatter.name).toBe("alpha");
		expect(exported?.frontmatter.title).toBe("Titulo Alpha");
	});
});
