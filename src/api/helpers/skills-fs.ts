import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readSkillFile, type SkillFile, writeSkillFile } from "@/lib/skills/parser";
import { dbProjects } from "../db/projects";
import { dbSkillSourcePaths } from "../db/skill-source-paths";
import { getSystemSettings } from "./system-settings";

export type SkillTool = "opencode" | "claude-code" | "codex" | "agents" | "koworker";
export type SkillScope = "global" | "project" | "custom";

type SkillRoot = {
	tool: SkillTool;
	scope: SkillScope;
	path: string;
};

export type SkillSourceInfo = {
	tool: SkillTool;
	scope: SkillScope;
	path: string;
	hash: string;
};

export type SkillVariant = {
	tool: SkillTool;
	scope: SkillScope;
	path: string;
	dir: string;
	content: string;
	description: string;
	metadata: Record<string, unknown>;
	hash: string;
	group: number;
};

export type SkillFsRecord = {
	slug: string;
	name: string;
	description: string;
	content: string;
	metadata: Record<string, unknown>;
	sources: SkillSourceInfo[];
	conflict: boolean;
	primaryPath: string;
	primaryDir: string;
};

export type SkillFsRecordDetailed = SkillFsRecord & { variants: SkillVariant[] };

const home = homedir();
const helpersDir = dirname(fileURLToPath(import.meta.url));
const STATIC_SKILLS_PATH = resolve(helpersDir, "../../../static/skills");

// Onde skills criadas pela UI são gravadas: o diretório global do opencode.
const CREATE_ROOT = join(home, ".config/opencode/skills");

// Static interno do koworker, resolvido relativo ao módulo (não é caminho do usuário). Menor
// prioridade de conteúdo: depois dos source_paths, antes dos projetos.
const KOWORKER_ROOT: SkillRoot = { tool: "koworker", scope: "global", path: STATIC_SKILLS_PATH };

// O diretório do projeto vem do `main_route` que ele mesmo guarda, não de `BASE/<nome>`: os projetos
// moram em caminhos arbitrários (vários fora de ~/Projects), então adivinhar a partir do nome erra.
async function projectRoots(projectName: string): Promise<SkillRoot[]> {
	const project = (await dbProjects.listRoots()).find((row) => row.name === projectName);
	if (!project) return [];

	return [
		{ tool: "opencode", scope: "project", path: join(project.main_route, ".opencode/skills") },
		{ tool: "claude-code", scope: "project", path: join(project.main_route, ".claude/skills") },
		{ tool: "codex", scope: "project", path: join(project.main_route, ".codex/skills") },
		{ tool: "agents", scope: "project", path: join(project.main_route, ".agents/skills") },
	];
}

// Roots vindos da tabela: os defaults por plataforma (scope 'global', semeados na primeira execução)
// e os extras do usuário (scope 'custom'), na ordem de cadastro. Essa ordem é a prioridade de
// conteúdo: o primeiro root que contém o slug é o dono do conteúdo exibido e do arquivo editável.
async function sourcePathRoots(): Promise<SkillRoot[]> {
	const rows = await dbSkillSourcePaths.list();
	return rows.map((row) => ({
		tool: row.tool as SkillTool,
		scope: row.scope as SkillScope,
		path: row.path,
	}));
}

async function buildRoots(projectName?: string): Promise<SkillRoot[]> {
	const base = [...(await sourcePathRoots()), KOWORKER_ROOT];
	return projectName ? [...base, ...(await projectRoots(projectName))] : base;
}

async function assertAllowedPath(target: string) {
	const resolved = resolve(target);
	const [rows, projects, settings] = await Promise.all([
		dbSkillSourcePaths.list(),
		dbProjects.listRoots(),
		getSystemSettings(),
	]);
	const prefixes = [
		home,
		STATIC_SKILLS_PATH,
		settings.projectsBasePath,
		...rows.map((row) => row.path),
		...projects.map((project) => project.main_route),
	];
	const allowed = prefixes.some((prefix) => resolved.startsWith(resolve(prefix)));
	if (!allowed || basename(resolved) !== "SKILL.md") {
		throw new Error("Caminho de skill inválido");
	}
}

// Hash do arquivo inteiro (descrição + corpo + metadata canônica), não só do corpo: o
// frontmatter pode divergir entre cópias e ainda assim é "conteúdo diferente". Metadata
// serializada com chaves ordenadas pra não falsear divergência por ordem de chave.
function skillContentHash(file: SkillFile): string {
	const { name: _name, description: _desc, ...rest } = file.frontmatter;
	const orderedMeta = Object.fromEntries(
		Object.keys(rest)
			.sort()
			.map((key) => [key, rest[key]]),
	);
	const canonical = `${file.frontmatter.description}\n---\n${file.body}\n---\n${JSON.stringify(orderedMeta)}`;
	return Bun.hash(canonical).toString();
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

type LoadedSource = {
	root: SkillRoot;
	dir: string;
	path: string;
	file: SkillFile;
	hash: string;
};

// Lê o SKILL.md de cada root (na ordem de prioridade) que tenha o slug e consiga ser parseado.
async function loadSourcesForSlug(slug: string, roots: SkillRoot[]): Promise<LoadedSource[]> {
	const loaded: LoadedSource[] = [];
	for (const root of roots) {
		const dir = join(root.path, slug);
		const path = join(dir, "SKILL.md");
		const file = await readSkillFile(path);
		if (!file) continue;
		loaded.push({ root, dir, path, file, hash: skillContentHash(file) });
	}
	return loaded;
}

function buildRecord(slug: string, loaded: LoadedSource[]): SkillFsRecord {
	const primary = loaded[0];
	const { name: _name, description: _desc, ...metadata } = primary.file.frontmatter;
	const conflict = new Set(loaded.map((source) => source.hash)).size > 1;

	return {
		slug,
		name: extractTitle(slug, primary.file.frontmatter),
		description: primary.file.frontmatter.description,
		content: primary.file.body,
		metadata,
		sources: loaded.map((source) => ({
			tool: source.root.tool,
			scope: source.root.scope,
			path: source.dir,
			hash: source.hash,
		})),
		conflict,
		primaryPath: primary.path,
		primaryDir: primary.dir,
	};
}

export async function listSkillsFromFs(projectName?: string): Promise<SkillFsRecord[]> {
	const roots = await buildRoots(projectName);

	const rootsBySlug = new Map<string, SkillRoot[]>();
	for (const root of roots) {
		for (const slug of await listSlugs(root)) {
			const existing = rootsBySlug.get(slug);
			if (existing) {
				existing.push(root);
			} else {
				rootsBySlug.set(slug, [root]);
			}
		}
	}

	const records: SkillFsRecord[] = [];
	for (const [slug, slugRoots] of rootsBySlug) {
		const loaded = await loadSourcesForSlug(slug, slugRoots);
		if (loaded.length === 0) continue;
		records.push(buildRecord(slug, loaded));
	}

	return records.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getSkillFromFs(
	slug: string,
	projectName?: string,
): Promise<SkillFsRecordDetailed | null> {
	const loaded = await loadSourcesForSlug(slug, await buildRoots(projectName));
	if (loaded.length === 0) return null;

	const groupByHash = new Map<string, number>();
	const variants: SkillVariant[] = loaded.map((source) => {
		let group = groupByHash.get(source.hash);
		if (group === undefined) {
			group = groupByHash.size;
			groupByHash.set(source.hash, group);
		}
		const { name: _name, description: _desc, ...metadata } = source.file.frontmatter;
		return {
			tool: source.root.tool,
			scope: source.root.scope,
			path: source.path,
			dir: source.dir,
			content: source.file.body,
			description: source.file.frontmatter.description,
			metadata,
			hash: source.hash,
			group,
		};
	});

	return { ...buildRecord(slug, loaded), variants };
}

// Sobrescreve todas as outras cópias do slug com o conteúdo da variante escolhida e relê cada
// arquivo gravado pra confirmar (read-back). Ação destrutiva — só chamada após confirmação na UI.
export async function standardizeSkillInFs(input: {
	slug: string;
	projectName?: string;
	sourcePath: string;
}): Promise<{ written: number }> {
	const loaded = await loadSourcesForSlug(input.slug, await buildRoots(input.projectName));
	const chosen = loaded.find((source) => source.path === input.sourcePath);
	if (!chosen) {
		throw new Error("Variante escolhida não encontrada");
	}

	let written = 0;
	for (const target of loaded) {
		if (target.path === chosen.path) continue;

		await assertAllowedPath(target.path);
		await writeSkillFile(target.path, chosen.file);

		const reread = await readSkillFile(target.path);
		if (!reread || skillContentHash(reread) !== chosen.hash) {
			throw new Error(`Falha ao padronizar ${target.path}: verificação não bateu`);
		}
		written++;
	}

	return { written };
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
		sources: [
			{ tool: "opencode", scope: "global", path: skillDir, hash: skillContentHash(skillFile) },
		],
		conflict: false,
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
	await assertAllowedPath(input.path);
	const slug = basename(dirname(input.path));

	await writeSkillFile(input.path, {
		frontmatter: { name: slug, description: input.description, ...input.metadata },
		body: input.content ?? "",
	});
}

export async function deleteSkillInFs(path: string): Promise<void> {
	await assertAllowedPath(path);
	await rm(dirname(path), { recursive: true, force: true });
}

// Remove a skill de TODAS as fontes onde ela existe (todas as cópias no disco).
export async function deleteAllSkillInFs(input: {
	slug: string;
	projectName?: string;
}): Promise<{ removed: number }> {
	const loaded = await loadSourcesForSlug(input.slug, await buildRoots(input.projectName));

	let removed = 0;
	for (const source of loaded) {
		await assertAllowedPath(source.path);
		await rm(source.dir, { recursive: true, force: true });
		removed++;
	}

	return { removed };
}
