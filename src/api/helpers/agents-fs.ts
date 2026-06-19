import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readSkillFile, type SkillFile, writeSkillFile } from "@/lib/skills/parser";
import { envVariables } from "../config/env";
import { dbAgentSourcePaths } from "../db/agent-source-paths";
import { dbProjects } from "../db/projects";

export type AgentTool = "claude-code" | "opencode" | "codex" | "koworker";
export type AgentScope = "global" | "project" | "custom";

type AgentRoot = {
	tool: AgentTool;
	scope: AgentScope;
	path: string;
};

export type AgentSourceInfo = {
	tool: AgentTool;
	scope: AgentScope;
	path: string;
	hash: string;
};

export type AgentVariant = {
	tool: AgentTool;
	scope: AgentScope;
	path: string;
	dir: string;
	content: string;
	description: string;
	metadata: Record<string, unknown>;
	hash: string;
	group: number;
};

export type AgentFsRecord = {
	slug: string;
	name: string;
	description: string;
	content: string;
	metadata: Record<string, unknown>;
	sources: AgentSourceInfo[];
	conflict: boolean;
	primaryPath: string;
	primaryDir: string;
};

export type AgentFsRecordDetailed = AgentFsRecord & { variants: AgentVariant[] };

const home = homedir();
const helpersDir = dirname(fileURLToPath(import.meta.url));
const STATIC_AGENTS_PATH = resolve(helpersDir, "../../../static/agents");
const PROJECTS_BASE_PATH = envVariables.PROJECTS_BASE_PATH ?? join(home, "Projects");

// Onde agents criados pela UI são gravados: o diretório global do claude-code.
const CREATE_ROOT = join(home, ".claude/agents");

// Ordem define prioridade de conteúdo: o primeiro root que contém o slug é o
// dono do conteúdo exibido e do arquivo editável. Globais sempre antes de projeto.
const GLOBAL_ROOTS: AgentRoot[] = [
	{ tool: "claude-code", scope: "global", path: CREATE_ROOT },
	{ tool: "opencode", scope: "global", path: join(home, ".config/opencode/agent") },
	{ tool: "codex", scope: "global", path: join(home, ".codex/agents") },
	{ tool: "koworker", scope: "global", path: STATIC_AGENTS_PATH },
];

// Roots de TODOS os projetos, não só do focado: os agents aparecem sempre, em qualquer projeto. O
// diretório de cada um vem do `main_route` que ele guarda (moram em caminhos arbitrários), não de
// `BASE/<nome>` — adivinhar pelo nome erra.
async function allProjectRoots(): Promise<AgentRoot[]> {
	const projects = await dbProjects.listRoots();
	return projects.flatMap((project): AgentRoot[] => [
		{ tool: "claude-code", scope: "project", path: join(project.main_route, ".claude/agents") },
		{ tool: "opencode", scope: "project", path: join(project.main_route, ".opencode/agent") },
		{ tool: "codex", scope: "project", path: join(project.main_route, ".codex/agents") },
	]);
}

// Caminhos extras cadastrados pelo usuário, somados entre os globais e os de projeto.
async function customRoots(): Promise<AgentRoot[]> {
	const rows = await dbAgentSourcePaths.list();
	return rows.map((row) => ({ tool: row.tool as AgentTool, scope: "custom", path: row.path }));
}

async function buildRoots(): Promise<AgentRoot[]> {
	return [...GLOBAL_ROOTS, ...(await customRoots()), ...(await allProjectRoots())];
}

const ALLOWED_PREFIXES = [home, STATIC_AGENTS_PATH, PROJECTS_BASE_PATH];

async function assertAllowedPath(target: string) {
	const resolved = resolve(target);
	const [rows, projects] = await Promise.all([dbAgentSourcePaths.list(), dbProjects.listRoots()]);
	const prefixes = [
		...ALLOWED_PREFIXES,
		...rows.map((row) => row.path),
		...projects.map((project) => project.main_route),
	];
	const allowed = prefixes.some((prefix) => resolved.startsWith(resolve(prefix)));
	if (!allowed || !basename(resolved).endsWith(".md")) {
		throw new Error("Caminho de agent inválido");
	}
}

// Hash do arquivo inteiro (descrição + corpo + metadata canônica), não só do corpo: o
// frontmatter pode divergir entre cópias e ainda assim é "conteúdo diferente". Metadata
// serializada com chaves ordenadas pra não falsear divergência por ordem de chave.
function agentContentHash(file: SkillFile): string {
	const { name: _name, description: _desc, ...rest } = file.frontmatter;
	const orderedMeta = Object.fromEntries(
		Object.keys(rest)
			.sort()
			.map((key) => [key, rest[key]]),
	);
	const canonical = `${file.frontmatter.description}\n---\n${file.body}\n---\n${JSON.stringify(orderedMeta)}`;
	return Bun.hash(canonical).toString();
}

async function listSlugs(root: AgentRoot): Promise<string[]> {
	try {
		const entries = await readdir(root.path, { withFileTypes: true });
		const slugs: string[] = [];
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			if (entry.name.endsWith(".md")) {
				slugs.push(basename(entry.name, ".md"));
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
	root: AgentRoot;
	dir: string;
	path: string;
	file: SkillFile;
	hash: string;
};

// Lê o <slug>.md de cada root (na ordem de prioridade) que tenha o slug e consiga ser parseado.
async function loadSourcesForSlug(slug: string, roots: AgentRoot[]): Promise<LoadedSource[]> {
	const loaded: LoadedSource[] = [];
	for (const root of roots) {
		const path = join(root.path, `${slug}.md`);
		const file = await readSkillFile(path);
		if (!file) continue;
		loaded.push({ root, dir: root.path, path, file, hash: agentContentHash(file) });
	}
	return loaded;
}

function buildRecord(slug: string, loaded: LoadedSource[]): AgentFsRecord {
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

export async function listAgentsFromFs(): Promise<AgentFsRecord[]> {
	const roots = await buildRoots();

	const rootsBySlug = new Map<string, AgentRoot[]>();
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

	const records: AgentFsRecord[] = [];
	for (const [slug, slugRoots] of rootsBySlug) {
		const loaded = await loadSourcesForSlug(slug, slugRoots);
		if (loaded.length === 0) continue;
		records.push(buildRecord(slug, loaded));
	}

	return records.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getAgentFromFs(slug: string): Promise<AgentFsRecordDetailed | null> {
	const loaded = await loadSourcesForSlug(slug, await buildRoots());
	if (loaded.length === 0) return null;

	const groupByHash = new Map<string, number>();
	const variants: AgentVariant[] = loaded.map((source) => {
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
export async function standardizeAgentInFs(input: {
	slug: string;
	sourcePath: string;
}): Promise<{ written: number }> {
	const loaded = await loadSourcesForSlug(input.slug, await buildRoots());
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
		if (!reread || agentContentHash(reread) !== chosen.hash) {
			throw new Error(`Falha ao padronizar ${target.path}: verificação não bateu`);
		}
		written++;
	}

	return { written };
}

export async function createAgentInFs(input: {
	slug: string;
	description: string;
	content?: string;
	metadata?: Record<string, unknown>;
}): Promise<AgentFsRecord | null> {
	const agentPath = join(CREATE_ROOT, `${input.slug}.md`);

	if (await Bun.file(agentPath).exists()) {
		throw new Error(`Já existe um agent com o slug "${input.slug}"`);
	}

	await mkdir(CREATE_ROOT, { recursive: true });
	await writeSkillFile(agentPath, {
		frontmatter: { name: input.slug, description: input.description, ...input.metadata },
		body: input.content ?? "",
	});

	const agentFile = await readSkillFile(agentPath);
	if (!agentFile) return null;

	const { name: _name, description: _desc, ...metadata } = agentFile.frontmatter;
	return {
		slug: input.slug,
		name: extractTitle(input.slug, agentFile.frontmatter),
		description: agentFile.frontmatter.description,
		content: agentFile.body,
		metadata,
		sources: [
			{
				tool: "claude-code",
				scope: "global",
				path: CREATE_ROOT,
				hash: agentContentHash(agentFile),
			},
		],
		conflict: false,
		primaryPath: agentPath,
		primaryDir: CREATE_ROOT,
	};
}

// Copia um agent pra dentro dos arquivos do projeto, em <main_route>/.claude/agents/<slug>.md, pra
// que o claude-code daquele projeto passe a enxergá-lo. Recusa se o projeto já tem o slug (não
// sobrescreve cópia divergente) e relê pra confirmar (write-then-verify).
export async function injectAgentIntoProject(input: {
	sourcePath: string;
	projectName: string;
}): Promise<{ path: string }> {
	const project = (await dbProjects.listRoots()).find((row) => row.name === input.projectName);
	if (!project) {
		throw new Error("Projeto não encontrado");
	}

	const source = await readSkillFile(input.sourcePath);
	if (!source) {
		throw new Error("Agent de origem não encontrado");
	}

	const slug = basename(input.sourcePath, ".md");
	const targetPath = join(project.main_route, ".claude/agents", `${slug}.md`);

	if (await Bun.file(targetPath).exists()) {
		throw new Error(`O projeto já tem um agent "${slug}"`);
	}

	await assertAllowedPath(targetPath);
	await mkdir(dirname(targetPath), { recursive: true });
	await writeSkillFile(targetPath, source);

	const reread = await readSkillFile(targetPath);
	if (!reread || agentContentHash(reread) !== agentContentHash(source)) {
		throw new Error(`Falha ao injetar em ${targetPath}: verificação não bateu`);
	}

	return { path: targetPath };
}

export async function updateAgentInFs(input: {
	path: string;
	description: string;
	content?: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	await assertAllowedPath(input.path);
	const slug = basename(input.path, ".md");

	await writeSkillFile(input.path, {
		frontmatter: { name: slug, description: input.description, ...input.metadata },
		body: input.content ?? "",
	});
}

export async function deleteAgentInFs(path: string): Promise<void> {
	await assertAllowedPath(path);
	await rm(path, { force: true });
}

// Remove o agent de TODAS as fontes onde ele existe (todas as cópias no disco).
export async function deleteAllAgentInFs(input: { slug: string }): Promise<{ removed: number }> {
	const loaded = await loadSourcesForSlug(input.slug, await buildRoots());

	let removed = 0;
	for (const source of loaded) {
		await assertAllowedPath(source.path);
		await rm(source.path, { force: true });
		removed++;
	}

	return { removed };
}
