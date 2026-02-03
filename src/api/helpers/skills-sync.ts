import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import { readSkillFile, writeSkillFile } from "@/lib/skills/parser";
import { dbSkills } from "../db/skills";
import { jsonParse, jsonStringify } from "../helpers/json";
import type { skills } from "../db/connection";

const SKILLS_CONFIG_PATH = join(homedir(), ".config/opencode/skills");

export async function syncSkillToConfig(skill: skills): Promise<void> {
	const skillDir = join(SKILLS_CONFIG_PATH, skill.slug);
	const skillPath = join(skillDir, "SKILL.md");
	const metadata = jsonParse<Record<string, unknown>>(skill.metadata) ?? {};

	await mkdir(skillDir, { recursive: true });
	await writeSkillFile(skillPath, {
		frontmatter: {
			name: skill.name,
			description: skill.description,
			...metadata,
		},
		body: skill.content || "",
	});
}

export async function removeSkillFromConfig(slug: string): Promise<void> {
	const { unlink, rm } = await import("node:fs/promises");
	const skillPath = join(SKILLS_CONFIG_PATH, slug);

	try {
		await rm(skillPath, { recursive: true, force: true });
	} catch {
		try {
			await unlink(join(skillPath, "SKILL.md"));
		} catch {
		}
	}
}

export async function importSkillsFromConfig(): Promise<{ imported: number; skipped: number }> {
	let imported = 0;
	let skipped = 0;

	try {
		const entries = await readdir(SKILLS_CONFIG_PATH, { withFileTypes: true });
		const skillDirs = entries.filter((e) => e.isDirectory());

		for (const dir of skillDirs) {
			const slug = dir.name;
			const skillPath = join(SKILLS_CONFIG_PATH, slug, "SKILL.md");

			try {
				const skillFile = await readSkillFile(skillPath);
				if (!skillFile) {
					continue;
				}
				const existing = await dbSkills.getBySlug(slug);

				if (existing) {
					skipped++;
					continue;
				}

				const metadata = { ...skillFile.frontmatter };
				delete metadata.name;
				delete metadata.description;

				await dbSkills.create({
					id: crypto.randomUUID(),
					slug,
					name: skillFile.frontmatter.name,
					description: skillFile.frontmatter.description,
					content: skillFile.body,
					metadata: jsonStringify(metadata),
					source: slug.startsWith("koworker-") ? "builtin" : "custom",
				});

				imported++;
			} catch (error) {
				console.error(`Falha ao importar skill ${slug}:`, error);
			}
		}
	} catch (error) {
		console.error("Falha ao importar skills da config:", error);
	}

	return { imported, skipped };
}

export async function exportSkillsToConfig(): Promise<{ exported: number; skipped: number }> {
	let exported = 0;
	let skipped = 0;

	await mkdir(SKILLS_CONFIG_PATH, { recursive: true });

	const existingSlugs = new Set<string>();
	try {
		const entries = await readdir(SKILLS_CONFIG_PATH, { withFileTypes: true });
		entries
			.filter((entry) => entry.isDirectory())
			.forEach((entry) => existingSlugs.add(entry.name));
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		if (err?.code !== "ENOENT") {
			console.error("Falha ao ler config de skills:", error);
		}
	}

	const rows = await dbSkills.getAll();
	for (const skill of rows) {
		if (existingSlugs.has(skill.slug)) {
			skipped++;
			continue;
		}

		try {
			await syncSkillToConfig(skill);
			exported++;
		} catch (error) {
			console.error(`Falha ao exportar skill ${skill.slug}:`, error);
		}
	}

	return { exported, skipped };
}
