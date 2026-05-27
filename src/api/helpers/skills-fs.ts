import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readSkillFile, writeSkillFile } from "@/lib/skills/parser";
import { envVariables } from "../config/env";

export type SkillTool = "opencode" | "claude-code" | "codex" | "agents" | "koworker";
export type SkillScope = "global" | "project";

type SkillRoot = {
	tool: SkillTool;
	scope: SkillScope;
	path: string;
};

export type SkillSourceInfo = {
	tool: SkillTool;
	scope: SkillScope;
	path: string;
};

export type SkillFsRecord = {
	slug: string;
	name: string;
	description: string;
	content: string;
	metadata: Record<string, unknown>;
	sources: SkillSourceInfo[];
	primaryPath: string;
	primaryDir: string;
};

const home = homedir();
const helpersDir = dirname(fileURLToPath(import.meta.url));
const STATIC_SKILLS_PATH = resolve(helpersDir, "../../../static/skills");
const PROJECTS_BASE_PATH = envVariables.PROJECTS_BASE_PATH ?? join(home, "Projects");

// Onde skills criadas pela UI são gravadas: o diretório global do opencode.
const CREATE_ROOT = join(home, ".config/opencode/skills");

// Ordem define prioridade de conteúdo: o primeiro root que contém o slug é o
// dono do conteúdo exibido e do arquivo editável. Globais sempre antes de projeto.
const GLOBAL_ROOTS: SkillRoot[] = [
	{ tool: "opencode", scope: "global", path: CREATE_ROOT },
	{ tool: "claude-code", scope: "global", path: join(home, ".claude/skills") },
	{ tool: "codex", scope: "global", path: join(home, ".codex/skills") },
	{ tool: "agents", scope: "global", path: join(home, ".agents/skills") },
	{ tool: "koworker", scope: "global", path: STATIC_SKILLS_PATH },
];

function projectRoots(projectName: string): SkillRoot[] {
	const projectDir = join(PROJECTS_BASE_PATH, projectName);
	return [
		{ tool: "opencode", scope: "project", path: join(projectDir, ".opencode/skills") },
		{ tool: "claude-code", scope: "project", path: join(projectDir, ".claude/skills") },
		{ tool: "codex", scope: "project", path: join(projectDir, ".codex/skills") },
		{ tool: "agents", scope: "project", path: join(projectDir, ".agents/skills") },
	];
}

const ALLOWED_PREFIXES = [home, STATIC_SKILLS_PATH, PROJECTS_BASE_PATH];

function assertAllowedPath(target: string) {
	const resolved = resolve(target);
	const allowed = ALLOWED_PREFIXES.some((prefix) => resolved.startsWith(resolve(prefix)));
	if (!allowed || basename(resolved) !== "SKILL.md") {
		throw new Error("Caminho de skill inválido");
	}
}

async function listSlugs(root: SkillRoot): Promise<string[]> {
	try {
		const entries = await readdir(root.path, { withFileTypes: true });
		const slugs: string[] = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (await Bun.file(join(root.path, entry.name, "SKILL.md")).exists()) {
				slugs.push(entry.name);
			}
		}
		return slugs;
	} catch {
		return [];
	}
}

function extractTitle(slug: string, frontmatter: Record<string, unknown>): string {
	const title = typeof frontmatter.title === "string" ? frontmatter.title.trim() : "";
	if (title) return title;
	const name = typeof frontmatter.name === "string" ? frontmatter.name.trim() : "";
	if (name && name !== slug) return name;
	return slug;
}

export async function listSkillsFromFs(projectName?: string): Promise<SkillFsRecord[]> {
	const roots = projectName ? [...GLOBAL_ROOTS, ...projectRoots(projectName)] : GLOBAL_ROOTS;

	const grouped = new Map<string, { sources: SkillRoot[]; primary: SkillRoot }>();
	for (const root of roots) {
		for (const slug of await listSlugs(root)) {
			const existing = grouped.get(slug);
			if (existing) {
				existing.sources.push(root);
			} else {
				grouped.set(slug, { sources: [root], primary: root });
			}
		}
	}

	const records: SkillFsRecord[] = [];
	for (const [slug, { sources, primary }] of grouped) {
		const primaryDir = join(primary.path, slug);
		const primaryPath = join(primaryDir, "SKILL.md");
		const skillFile = await readSkillFile(primaryPath);
		if (!skillFile) continue;

		const { name: _name, description: _desc, ...metadata } = skillFile.frontmatter;
		records.push({
			slug,
			name: extractTitle(slug, skillFile.frontmatter),
			description: skillFile.frontmatter.description,
			content: skillFile.body,
			metadata,
			sources: sources.map((source) => ({
				tool: source.tool,
				scope: source.scope,
				path: join(source.path, slug),
			})),
			primaryPath,
			primaryDir,
		});
	}

	return records.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function createSkillInFs(input: {
	slug: string;
	description: string;
	content?: string;
	metadata?: Record<string, unknown>;
}): Promise<SkillFsRecord | null> {
	const skillDir = join(CREATE_ROOT, input.slug);
	const skillPath = join(skillDir, "SKILL.md");

	if (await Bun.file(skillPath).exists()) {
		throw new Error(`Já existe uma skill com o slug "${input.slug}"`);
	}

	await mkdir(skillDir, { recursive: true });
	await writeSkillFile(skillPath, {
		frontmatter: { name: input.slug, description: input.description, ...input.metadata },
		body: input.content ?? "",
	});

	const skillFile = await readSkillFile(skillPath);
	if (!skillFile) return null;

	const { name: _name, description: _desc, ...metadata } = skillFile.frontmatter;
	return {
		slug: input.slug,
		name: extractTitle(input.slug, skillFile.frontmatter),
		description: skillFile.frontmatter.description,
		content: skillFile.body,
		metadata,
		sources: [{ tool: "opencode", scope: "global", path: skillDir }],
		primaryPath: skillPath,
		primaryDir: skillDir,
	};
}

export async function updateSkillInFs(input: {
	path: string;
	description: string;
	content?: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	assertAllowedPath(input.path);
	const slug = basename(dirname(input.path));

	await writeSkillFile(input.path, {
		frontmatter: { name: slug, description: input.description, ...input.metadata },
		body: input.content ?? "",
	});
}

export async function deleteSkillInFs(path: string): Promise<void> {
	assertAllowedPath(path);
	await rm(dirname(path), { recursive: true, force: true });
}
