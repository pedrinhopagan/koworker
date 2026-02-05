import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../src/api/db/connection";
import { jsonStringify } from "../src/api/helpers/json";
import { readSkillFile, type SkillFile } from "../src/lib/skills/parser";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const SKILLS_CONFIG_PATH = join(homedir(), ".config/opencode/skills");
const BUILTIN_SKILLS_PATH = join(scriptsDir, "../static/skills");

const createId = () => crypto.randomUUID();
const now = Date.now();

const normalizeName = (value: string) =>
	value
		.normalize("NFD")
		.replaceAll(/[\u0300-\u036F]/g, "")
		.trim()
		.toLowerCase();

async function upsertBuiltinSkill(slug: string, skillFile: SkillFile): Promise<void> {
	const {
		name: frontmatterName,
		description: _description,
		...metadata
	} = skillFile.frontmatter as Record<string, unknown>;
	const title =
		typeof skillFile.frontmatter.title === "string"
			? skillFile.frontmatter.title
			: typeof frontmatterName === "string" && frontmatterName !== slug
				? frontmatterName
				: undefined;
	if (title) {
		metadata.title = title;
	}

	const existing = await db
		.selectFrom("skills")
		.select(["id"])
		.where("slug", "=", slug)
		.executeTakeFirst();

	if (existing) {
		await db
			.updateTable("skills")
			.set({
				name: slug,
				description: skillFile.frontmatter.description,
				content: skillFile.body,
				metadata: jsonStringify(metadata),
				source: "builtin",
				updated_at: now,
			})
			.where("id", "=", existing.id)
			.executeTakeFirst();
		return;
	}

	const maxOrder = await db
		.selectFrom("skills")
		.select(({ fn }) => [fn.max("display_order").as("maxOrder")])
		.where("source", "=", "builtin")
		.executeTakeFirst();
	const displayOrder = ((maxOrder?.maxOrder as number | null) ?? -1) + 1;

	await db
		.insertInto("skills")
		.values({
			id: createId(),
			slug,
			name: slug,
			description: skillFile.frontmatter.description,
			content: skillFile.body,
			metadata: jsonStringify(metadata),
			source: "builtin",
			display_order: displayOrder,
			created_at: now,
		})
		.executeTakeFirst();
}

type SkillDirent = { name: string; isDirectory: () => boolean };

async function seedBuiltinSkillsFromPath(basePath: string, importedSlugs: Set<string>) {
	let entries: SkillDirent[];
	try {
		entries = (await readdir(basePath, { withFileTypes: true })) as SkillDirent[];
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		if (err?.code === "ENOENT") {
			return;
		}
		throw error;
	}

	const skillDirs = entries.filter((entry) => entry.isDirectory());

	for (const dir of skillDirs) {
		const slug = String(dir.name);
		if (importedSlugs.has(slug)) continue;

		const skillFile = await readSkillFile(join(basePath, slug, "SKILL.md"));
		if (!skillFile) continue;

		await upsertBuiltinSkill(slug, skillFile);
	}
}

await db
	.insertInto("users")
	.values({
		name: "admin",
		password: Bun.password.hashSync("password"),
	})
	.execute();

const defaultCategories = [
	{ name: "feature", color: "#22c55e" },
	{ name: "fix", color: "#ef4444" },
	{ name: "test", color: "#3b82f6" },
	{ name: "doc", color: "#a855f7" },
];

const existingCategories = await db.selectFrom("categories").select(["name"]).execute();
const existingCategoryNames = new Set(existingCategories.map((item) => normalizeName(item.name)));

const categoriesToInsert = defaultCategories
	.filter((item) => !existingCategoryNames.has(normalizeName(item.name)))
	.map((item, index) => ({
		id: createId(),
		name: item.name,
		color: item.color,
		display_order: index,
		created_at: now,
	}));

if (categoriesToInsert.length > 0) {
	await db.insertInto("categories").values(categoriesToInsert).execute();
}

const defaultPriorities = [
	{ name: "Alta", level: 1, color: "#ef4444" },
	{ name: "Media", level: 2, color: "#f59e0b" },
	{ name: "Baixa", level: 3, color: "#22c55e" },
];

const existingPriorities = await db.selectFrom("priorities").select(["name"]).execute();
const existingPriorityNames = new Set(existingPriorities.map((item) => normalizeName(item.name)));

const prioritiesToInsert = defaultPriorities
	.filter((item) => !existingPriorityNames.has(normalizeName(item.name)))
	.map((item, index) => ({
		id: createId(),
		name: item.name,
		level: item.level,
		color: item.color,
		display_order: index,
		created_at: now,
	}));

if (prioritiesToInsert.length > 0) {
	await db.insertInto("priorities").values(prioritiesToInsert).execute();
}

try {
	const importedSlugs = new Set<string>();
	const entries = await readdir(SKILLS_CONFIG_PATH, { withFileTypes: true });
	const skillDirs = entries.filter(
		(entry) => entry.isDirectory() && entry.name.startsWith("koworker-"),
	);

	for (const dir of skillDirs) {
		const slug = dir.name;
		const skillFile = await readSkillFile(join(SKILLS_CONFIG_PATH, slug, "SKILL.md"));

		if (!skillFile) {
			continue;
		}

		await upsertBuiltinSkill(slug, skillFile);

		importedSlugs.add(slug);
	}

	await seedBuiltinSkillsFromPath(BUILTIN_SKILLS_PATH, importedSlugs);
} catch (error) {
	const err = error as NodeJS.ErrnoException;
	if (err?.code === "ENOENT") {
		await seedBuiltinSkillsFromPath(BUILTIN_SKILLS_PATH, new Set<string>());
	} else {
		console.error("Falha ao importar skills koworker para o seed:", error);
	}
}
