import { mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSkillFile, writeSkillFile } from "@/lib/skills/parser";
import type { skills } from "../db/connection";
import { dbSkills } from "../db/skills";
import { jsonParse, jsonStringify } from "../helpers/json";

const SKILLS_CONFIG_PATH = join(homedir(), ".config/opencode/skills");
const helpersDir = dirname(fileURLToPath(import.meta.url));
const STATIC_SKILLS_PATH = join(helpersDir, "../../../static/skills");

export type SkillConflictStrategy = "overwrite" | "ignore";

export type SkillSyncOptions = {
	slugs?: string[];
	conflictStrategy?: SkillConflictStrategy;
	configPath?: string;
};

export type SkillPreviewOptions = {
	configPath?: string;
};

export type SkillPreviewItem = {
	slug: string;
	hasConflict: boolean;
};

const resolveConfigPath = (configPath?: string) => configPath ?? SKILLS_CONFIG_PATH;

const normalizeSkillMetadata = (metadata: Record<string, unknown>) => {
	const normalized = { ...metadata };
	delete normalized.name;
	delete normalized.description;
	return normalized;
};

const extractSkillTitle = (slug: string, frontmatter: Record<string, unknown>): string | null => {
	const title = typeof frontmatter.title === "string" ? frontmatter.title.trim() : "";
	if (title) return title;
	const name = typeof frontmatter.name === "string" ? frontmatter.name.trim() : "";
	if (name && name !== slug) return name;
	return null;
};

export async function syncSkillToConfig(skill: skills, configPath?: string): Promise<void> {
	const basePath = resolveConfigPath(configPath);
	const skillDir = join(basePath, skill.slug);
	const skillPath = join(skillDir, "SKILL.md");
	const metadata = jsonParse<Record<string, unknown>>(skill.metadata) ?? {};
	const { title, ...restMetadata } = metadata as Record<string, unknown>;
	const frontmatterTitle = typeof title === "string" && title.trim() ? title.trim() : undefined;

	await mkdir(skillDir, { recursive: true });
	await writeSkillFile(skillPath, {
		frontmatter: {
			name: skill.slug,
			description: skill.description,
			...(frontmatterTitle ? { title: frontmatterTitle } : {}),
			...restMetadata,
		},
		body: skill.content || "",
	});
}

export async function removeSkillFromConfig(slug: string, configPath?: string): Promise<void> {
	const { unlink, rm } = await import("node:fs/promises");
	const skillPath = join(resolveConfigPath(configPath), slug);

	try {
		await rm(skillPath, { recursive: true, force: true });
	} catch {
		try {
			await unlink(join(skillPath, "SKILL.md"));
		} catch {}
	}
}

export async function listConfigSkillSlugs(configPath = SKILLS_CONFIG_PATH): Promise<string[]> {
	try {
		const entries = await readdir(configPath, { withFileTypes: true });
		const slugs: string[] = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const slug = entry.name;
			const skillPath = join(configPath, slug, "SKILL.md");
			if (await Bun.file(skillPath).exists()) {
				slugs.push(slug);
			}
		}
		return slugs.sort((a, b) => a.localeCompare(b));
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		if (err?.code !== "ENOENT") {
			console.error("Falha ao ler config de skills:", error);
		}
		return [];
	}
}

export async function previewImportFromConfig(
	options: SkillPreviewOptions = {},
): Promise<SkillPreviewItem[]> {
	const basePath = resolveConfigPath(options.configPath);
	const configSlugs = await listConfigSkillSlugs(basePath);
	const existing = new Set((await dbSkills.getAll()).map((row) => row.slug));

	return configSlugs.map((slug) => ({
		slug,
		hasConflict: existing.has(slug),
	}));
}

export async function previewExportToConfig(
	options: SkillPreviewOptions = {},
): Promise<SkillPreviewItem[]> {
	const basePath = resolveConfigPath(options.configPath);
	const configSlugs = new Set(await listConfigSkillSlugs(basePath));
	const rows = await dbSkills.getAll();

	return rows.map((row) => ({
		slug: row.slug,
		hasConflict: configSlugs.has(row.slug),
	}));
}

export async function importSkillsFromConfig(
	options: SkillSyncOptions = {},
): Promise<{ imported: number; skipped: number; overwritten: number }> {
	const { slugs, conflictStrategy = "ignore", configPath } = options;
	const basePath = resolveConfigPath(configPath);
	const selectedSlugs = slugs ? new Set(slugs) : null;
	const configSlugs = await listConfigSkillSlugs(basePath);
	const existingRows = await dbSkills.getAll();
	const existingBySlug = new Map(existingRows.map((row) => [row.slug, row] as const));

	let imported = 0;
	let skipped = 0;
	let overwritten = 0;

	for (const slug of configSlugs) {
		if (selectedSlugs && !selectedSlugs.has(slug)) continue;
		const skillPath = join(basePath, slug, "SKILL.md");

		try {
			const skillFile = await readSkillFile(skillPath);
			if (!skillFile) {
				continue;
			}

			const existing = existingBySlug.get(slug);
			const metadata = normalizeSkillMetadata(skillFile.frontmatter);
			const title = extractSkillTitle(slug, skillFile.frontmatter);
			if (title) metadata.title = title;
			const source = slug.startsWith("koworker-") ? "builtin" : "custom";

			if (existing) {
				if (conflictStrategy === "ignore") {
					skipped++;
					continue;
				}

				await dbSkills.update({
					id: existing.id,
					name: slug,
					description: skillFile.frontmatter.description,
					content: skillFile.body,
					metadata: jsonStringify(metadata),
					source,
				});

				overwritten++;
				continue;
			}

			await dbSkills.create({
				id: crypto.randomUUID(),
				slug,
				name: slug,
				description: skillFile.frontmatter.description,
				content: skillFile.body,
				metadata: jsonStringify(metadata),
				source,
			});

			imported++;
		} catch (error) {
			console.error(`Falha ao importar skill ${slug}:`, error);
		}
	}

	return { imported, skipped, overwritten };
}

export async function exportSkillsToConfig(
	options: SkillSyncOptions = {},
): Promise<{ exported: number; skipped: number; overwritten: number }> {
	const { slugs, conflictStrategy = "ignore", configPath } = options;
	const basePath = resolveConfigPath(configPath);
	const selectedSlugs = slugs ? new Set(slugs) : null;

	await mkdir(basePath, { recursive: true });

	const existingSlugs = new Set(await listConfigSkillSlugs(basePath));
	const rows = await dbSkills.getAll();

	let exported = 0;
	let skipped = 0;
	let overwritten = 0;

	for (const skill of rows) {
		if (selectedSlugs && !selectedSlugs.has(skill.slug)) continue;

		const hasConflict = existingSlugs.has(skill.slug);
		if (hasConflict && conflictStrategy === "ignore") {
			skipped++;
			continue;
		}

		try {
			await syncSkillToConfig(skill, basePath);
			if (hasConflict) {
				overwritten++;
			} else {
				exported++;
			}
		} catch (error) {
			console.error(`Falha ao exportar skill ${skill.slug}:`, error);
		}
	}

	return { exported, skipped, overwritten };
}

export async function syncDefaultSkillsFromStatic(): Promise<{ inserted: number }> {
	const entries = await readdir(STATIC_SKILLS_PATH, { withFileTypes: true });
	const slugs = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));

	await dbSkills.deleteBySource("builtin");

	let inserted = 0;
	for (const slug of slugs) {
		const skillPath = join(STATIC_SKILLS_PATH, slug, "SKILL.md");
		const skillFile = await readSkillFile(skillPath);
		if (!skillFile) continue;

		const metadata = normalizeSkillMetadata(skillFile.frontmatter);
		const title = extractSkillTitle(slug, skillFile.frontmatter);
		if (title) metadata.title = title;
		await dbSkills.create({
			id: crypto.randomUUID(),
			slug,
			name: slug,
			description: skillFile.frontmatter.description,
			content: skillFile.body,
			metadata: jsonStringify(metadata),
			source: slug.startsWith("koworker-") ? "builtin" : "custom",
		});
		inserted++;
	}

	return { inserted };
}
