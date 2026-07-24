import { cp, lstat, mkdir, readdir, realpath, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ORPCError } from "@orpc/server";
import {
	readSkillFile,
	serializeSkillMd,
	type SkillFile,
	writeSkillFile,
} from "@/lib/skills/parser";
import { dbProjects } from "../db/projects";
import { dbSkillSettings } from "../db/skill-settings";
import { dbSkillSourcePaths } from "../db/skill-source-paths";
import { expandTilde } from "./os-actions";
import {
	exportSkillDirectoryText,
	inspectSkillDirectory,
	readSkillDirectoryText,
	replaceSkillDirectories,
	type SkillDirectoryFile,
	type SkillDirectoryManifest,
} from "./skill-directory";

export type SkillTool = "opencode" | "claude-code" | "codex" | "agents" | "koworker";
export type SkillScope = "global" | "project" | "custom";

export const SYNCED_SKILL_TOOLS = new Set<SkillTool>([
	"opencode",
	"claude-code",
	"codex",
	"agents",
]);

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
	contentHash: string;
};

export type SkillVariant = {
	tool: SkillTool;
	scope: SkillScope;
	path: string;
	dir: string;
	name: string;
	content: string;
	description: string;
	metadata: Record<string, unknown>;
	hash: string;
	skillHash: string;
	contentHash: string;
	files: SkillDirectoryFile[];
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

export type SkillFsRecordDetailed = SkillFsRecord & {
	variants: SkillVariant[];
	missingTools: SkillTool[];
};

const home = homedir();
const helpersDir = dirname(fileURLToPath(import.meta.url));
const STATIC_SKILLS_PATH = resolve(helpersDir, "../../../static/skills");

const CREATE_ROOT = join(home, ".agents/skills");
export const SKILL_DELETE_BACKUP_ROOT = join(home, "Documentos", "backups", "koworker", "skills");

// Static interno do koworker, resolvido relativo ao módulo (não é caminho do usuário). Menor
// prioridade de conteúdo: depois dos source_paths, antes dos projetos.
const KOWORKER_ROOT: SkillRoot = { tool: "koworker", scope: "global", path: STATIC_SKILLS_PATH };

// O diretório do projeto vem do `main_route` que ele mesmo guarda, não de `BASE/<nome>`: os projetos
// moram em caminhos arbitrários (vários fora de ~/Projects), então adivinhar a partir do nome erra.
async function projectRoots(projectName: string): Promise<SkillRoot[]> {
	const project = (await dbProjects.listRoots()).find((row) => row.name === projectName);
	if (!project) return [];

	return projectSkillRoots(project.main_route);
}

function projectSkillRoots(mainRoute: string): SkillRoot[] {
	return [
		{ tool: "opencode", scope: "project", path: join(mainRoute, ".opencode/skills") },
		{ tool: "claude-code", scope: "project", path: join(mainRoute, ".claude/skills") },
		{ tool: "codex", scope: "project", path: join(mainRoute, ".codex/skills") },
		{ tool: "agents", scope: "project", path: join(mainRoute, ".agents/skills") },
	];
}

// Roots vindos da tabela: os defaults por plataforma (scope 'global', garantidos no boot) e os
// extras do usuário (scope 'custom'), na ordem de cadastro. O til é expandido. Essa ordem é a
// prioridade de conteúdo: o primeiro root que contém o slug é o dono do conteúdo exibido e do
// arquivo editável.
async function sourcePathRoots(): Promise<SkillRoot[]> {
	const rows = await dbSkillSourcePaths.list();
	return rows.map((row) => ({
		tool: row.tool as SkillTool,
		scope: row.scope as SkillScope,
		path: expandTilde(row.path),
	}));
}

async function agentsSkillsRoot() {
	const configured = (await sourcePathRoots()).find(
		(root) => root.scope === "global" && root.tool === "agents",
	);

	return configured?.path ?? CREATE_ROOT;
}

// Deduplica por path resolvido, mantendo a primeira ocorrência: o mesmo diretório cadastrado duas
// vezes (ex.: uma linha custom `~/.claude/skills` e a global expandida) entraria em conflito consigo
// mesmo. A ordem original é a prioridade de conteúdo, então a primeira vence.
async function rootIdentity(root: SkillRoot) {
	return await realpath(root.path).catch((err: any) => {
		if (err?.code === "ENOENT" || err?.code === "ENOTDIR") {
			return resolve(root.path);
		}
		throw err;
	});
}

async function deduplicateRoots(roots: SkillRoot[]) {
	const seen = new Set<string>();
	const deduplicated: SkillRoot[] = [];
	for (const root of roots) {
		const identity = await rootIdentity(root);
		if (!seen.has(identity)) {
			seen.add(identity);
			deduplicated.push(root);
		}
	}

	return deduplicated;
}

async function buildRoots(projectName?: string): Promise<SkillRoot[]> {
	const sourceRoots = await sourcePathRoots();
	const base = [
		...sourceRoots.filter((root) => root.scope === "global" && root.tool === "agents"),
		...sourceRoots.filter((root) => root.scope !== "global" || root.tool !== "agents"),
		KOWORKER_ROOT,
	];

	return await deduplicateRoots(
		projectName ? [...base, ...(await projectRoots(projectName))] : base,
	);
}

async function buildDeletableRoots() {
	const sourceRoots = await sourcePathRoots();
	const projects = await dbProjects.listRoots();
	const roots = await deduplicateRoots([
		...sourceRoots,
		...projects.flatMap((project) => projectSkillRoots(project.main_route)),
	]);
	const staticIdentity = await rootIdentity(KOWORKER_ROOT);
	const identities = await Promise.all(roots.map(rootIdentity));

	return roots.filter((_, index) => identities[index] !== staticIdentity);
}

// Hash do arquivo inteiro (descrição + corpo + metadata canônica), não só do corpo: o
// frontmatter pode divergir entre cópias e ainda assim é "conteúdo diferente". Metadata
// serializada com chaves ordenadas pra não falsear divergência por ordem de chave.
export function skillContentHash(file: SkillFile): string {
	function ordered(value: unknown): unknown {
		if (Array.isArray(value)) {
			return value.map(ordered);
		}
		if (value && typeof value === "object") {
			return Object.fromEntries(
				Object.entries(value)
					.sort(([left], [right]) => {
						if (left < right) {
							return -1;
						}
						if (left > right) {
							return 1;
						}
						return 0;
					})
					.map(([key, child]) => [key, ordered(child)]),
			);
		}
		return value;
	}

	const canonical = `${JSON.stringify(ordered(file.frontmatter))}\n---\n${file.body}`;
	return Bun.hash(canonical).toString();
}

async function listSlugs(root: SkillRoot): Promise<string[]> {
	try {
		const entries = await readdir(root.path, { withFileTypes: true });
		const checked = await Promise.all(
			entries.map(async (entry) => {
				if (!entry.isDirectory() && !entry.isSymbolicLink()) return null;
				const skillFile = await lstat(join(root.path, entry.name, "SKILL.md")).catch(() => null);
				return skillFile?.isFile() || skillFile?.isSymbolicLink() ? entry.name : null;
			}),
		);
		return checked.filter((slug): slug is string => slug !== null);
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
	manifest: SkillDirectoryManifest;
};

// Lê o SKILL.md de cada root (na ordem de prioridade) que tenha o slug e consiga ser parseado.
async function loadSourcesForSlug(slug: string, roots: SkillRoot[]): Promise<LoadedSource[]> {
	const loaded = await Promise.all(
		roots.map(async (root) => {
			const dir = join(root.path, slug);
			const path = join(dir, "SKILL.md");
			const manifest = await inspectSkillDirectory(dir).catch((err: any) => {
				if (err?.code === "ENOENT" || err?.code === "ENOTDIR") {
					return null;
				}
				throw err;
			});
			if (!manifest || !manifest.files.some((file) => file.path === "SKILL.md")) {
				return null;
			}
			const file = await readSkillFile(path);
			if (!file) return null;
			return { root, dir, path, file, hash: skillContentHash(file), manifest };
		}),
	);
	return loaded.filter((source): source is LoadedSource => source !== null);
}

async function loadDetailedSourcesForSlug(slug: string, roots: SkillRoot[]) {
	return await loadSourcesForSlug(slug, roots);
}

export async function resolveKnownSkillVariant(input: {
	slug: string;
	projectName?: string;
	variantPath: string;
}) {
	const loaded = await loadDetailedSourcesForSlug(input.slug, await buildRoots(input.projectName));
	const variantPath = resolve(input.variantPath);
	const source = loaded.find((candidate) => resolve(candidate.path) === variantPath);
	if (!source) {
		throw new Error("Variante de skill não encontrada nas fontes autorizadas");
	}

	return source;
}

function buildRecord(slug: string, loaded: LoadedSource[]): SkillFsRecord {
	const primary = loaded[0];
	const { name: _name, description: _desc, ...metadata } = primary.file.frontmatter;
	const conflict = new Set(loaded.map((source) => source.manifest.contentHash)).size > 1;

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
			contentHash: source.manifest.contentHash,
		})),
		conflict,
		primaryPath: primary.path,
		primaryDir: primary.dir,
	};
}

export async function listSkillsFromFs(projectName?: string): Promise<SkillFsRecord[]> {
	const roots = await buildRoots(projectName);

	const slugsPerRoot = await Promise.all(roots.map((root) => listSlugs(root)));

	const rootsBySlug = new Map<string, SkillRoot[]>();
	for (const [index, root] of roots.entries()) {
		for (const slug of slugsPerRoot[index]) {
			const existing = rootsBySlug.get(slug);
			if (existing) {
				existing.push(root);
			} else {
				rootsBySlug.set(slug, [root]);
			}
		}
	}

	const records = await Promise.all(
		[...rootsBySlug].map(async ([slug, slugRoots]) => {
			const loaded = await loadDetailedSourcesForSlug(slug, slugRoots);
			return loaded.length === 0 ? null : buildRecord(slug, loaded);
		}),
	);

	return records
		.filter((record): record is SkillFsRecord => record !== null)
		.sort((a, b) => a.slug.localeCompare(b.slug));
}

function missingSyncedRoots(slug: string, roots: SkillRoot[], loaded: LoadedSource[]) {
	const presentDirs = new Set(loaded.map((source) => resolve(source.dir)));

	return roots.filter(
		(root) =>
			root.scope === "global" &&
			SYNCED_SKILL_TOOLS.has(root.tool) &&
			!presentDirs.has(resolve(join(root.path, slug))),
	);
}

export async function getSkillFromFs(
	slug: string,
	projectName?: string,
): Promise<SkillFsRecordDetailed | null> {
	const roots = await buildRoots(projectName);
	const loaded = await loadDetailedSourcesForSlug(slug, roots);
	if (loaded.length === 0) return null;

	const groupByHash = new Map<string, number>();
	const variants: SkillVariant[] = loaded.map((source) => {
		let group = groupByHash.get(source.manifest.contentHash);
		if (group === undefined) {
			group = groupByHash.size;
			groupByHash.set(source.manifest.contentHash, group);
		}
		const { name: _name, description: _desc, ...metadata } = source.file.frontmatter;
		return {
			tool: source.root.tool,
			scope: source.root.scope,
			path: source.path,
			dir: source.dir,
			name: source.file.frontmatter.name,
			content: source.file.body,
			description: source.file.frontmatter.description,
			metadata,
			hash: source.hash,
			skillHash: source.hash,
			contentHash: source.manifest.contentHash,
			files: source.manifest.files,
			group,
		};
	});

	return {
		...buildRecord(slug, loaded),
		variants,
		missingTools: [...new Set(missingSyncedRoots(slug, roots, loaded).map((root) => root.tool))],
	};
}

export async function standardizeSkillInFs(input: {
	slug: string;
	projectName?: string;
	variantPath: string;
	planHash: string;
}) {
	const preview = await previewSkillStandardizationInFs(input);
	if (preview.planHash !== input.planHash) {
		throw new ORPCError("CONFLICT", {
			message: "As skills mudaram desde a análise. Revise a padronização novamente",
		});
	}

	const replacement = await replaceSkillDirectories(
		preview.targets.map((target) => ({
			sourceDir: preview.sourceDir,
			targetDir: target.dir,
			expectedContentHash: preview.sourceContentHash,
			expectedTargetContentHash: target.expectedContentHash,
		})),
	);

	return {
		updated: preview.updated,
		created: preview.created,
		removedFiles: preview.removedFiles,
		backupPath: replacement.quarantinePaths.at(0) ?? null,
	};
}

export async function previewSkillStandardizationInFs(input: {
	slug: string;
	projectName?: string;
	variantPath: string;
}) {
	const roots = await buildRoots(input.projectName);
	const loaded = await loadDetailedSourcesForSlug(input.slug, roots);
	const chosen = loaded.find((source) => resolve(source.path) === resolve(input.variantPath));
	if (!chosen) {
		throw new Error("Variante escolhida não encontrada");
	}

	const existingTargets = loaded.filter(
		(source) =>
			source.path !== chosen.path && source.manifest.contentHash !== chosen.manifest.contentHash,
	);
	const missing = missingSyncedRoots(input.slug, roots, loaded);
	const targets = [
		...existingTargets.map((source) => ({
			dir: source.dir,
			expectedContentHash: source.manifest.contentHash,
			created: false,
		})),
		...missing.map((root) => ({
			dir: join(root.path, input.slug),
			expectedContentHash: null,
			created: true,
		})),
	];
	const sourcePaths = new Set(chosen.manifest.files.map((file) => file.path));
	const removedPaths = existingTargets.flatMap((source) =>
		source.manifest.files
			.filter((file) => !sourcePaths.has(file.path))
			.map((file) => `${source.dir}:${file.path}`),
	);
	const planHash = Bun.hash(
		JSON.stringify({
			source: { path: resolve(chosen.path), contentHash: chosen.manifest.contentHash },
			targets,
		}),
	).toString();

	return {
		planHash,
		sourceSkillHash: chosen.hash,
		sourceContentHash: chosen.manifest.contentHash,
		sourceDir: chosen.dir,
		updated: existingTargets.length,
		created: missing.length,
		removedFiles: removedPaths.length,
		removedPaths,
		targets,
	};
}

export async function createSkillInFs(input: {
	slug: string;
	description: string;
	content?: string;
	metadata?: Record<string, unknown>;
}): Promise<SkillFsRecord | null> {
	const skillDir = join(await agentsSkillsRoot(), input.slug);
	const skillPath = join(skillDir, "SKILL.md");

	if (await Bun.file(skillPath).exists()) {
		throw new Error(`Já existe uma skill com o slug "${input.slug}"`);
	}

	await mkdir(skillDir, { recursive: true });
	await writeSkillFile(skillPath, {
		frontmatter: { ...input.metadata, name: input.slug, description: input.description },
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
			{
				tool: "agents",
				scope: "global",
				path: skillDir,
				hash: skillContentHash(skillFile),
				contentHash: (await inspectSkillDirectory(skillDir)).contentHash,
			},
		],
		conflict: false,
		primaryPath: skillPath,
		primaryDir: skillDir,
	};
}

export async function updateSkillInFs(input: {
	slug: string;
	projectName?: string;
	variantPath: string;
	description: string;
	content: string;
	metadata: Record<string, unknown>;
	expectedSkillHash: string;
}) {
	const source = await resolveKnownSkillVariant(input);
	if (source.hash !== input.expectedSkillHash) {
		throw new Error("A skill mudou desde a última leitura. Recarregue antes de salvar");
	}

	const temporary = join(source.dir, `.${crypto.randomUUID()}.koworker-update`);
	const content = serializeSkillMd({
		frontmatter: {
			...input.metadata,
			name: source.file.frontmatter.name,
			description: input.description,
		},
		body: input.content,
	});
	await Bun.write(temporary, content);
	await rename(temporary, source.path).catch(async (err) => {
		await rm(temporary, { force: true });
		throw err;
	});

	const reread = await readSkillFile(source.path);
	if (!reread) {
		throw new Error("Não foi possível validar a skill salva");
	}
	const manifest = await inspectSkillDirectory(source.dir);

	return {
		skillHash: skillContentHash(reread),
		contentHash: manifest.contentHash,
		files: manifest.files,
	};
}

export async function renameSkillInFs(input: {
	slug: string;
	newSlug: string;
	projectName?: string;
	expectedVariants?: { path: string; contentHash: string }[];
}) {
	if (input.slug === input.newSlug) {
		return await getSkillFromFs(input.slug, input.projectName);
	}

	const roots = await buildRoots(input.projectName);
	const loaded = await loadDetailedSourcesForSlug(input.slug, roots);
	if (loaded.length === 0) {
		throw new Error("Skill não encontrada");
	}
	if (input.expectedVariants) {
		const expected = new Map(
			input.expectedVariants.map((variant) => [resolve(variant.path), variant.contentHash]),
		);
		const stale =
			expected.size !== loaded.length ||
			loaded.some((source) => expected.get(resolve(source.path)) !== source.manifest.contentHash);
		if (stale) {
			throw new Error("A skill mudou desde a última leitura. Recarregue antes de renomear");
		}
	}

	const moves = await Promise.all(
		loaded.map(async (source) => ({
			source,
			targetDir: join(source.root.path, input.newSlug),
			originalContent: await Bun.file(source.path).text(),
		})),
	);
	for (const move of moves) {
		const targetExists = await lstat(move.targetDir)
			.then(() => true)
			.catch((err: any) => {
				if (err?.code === "ENOENT") {
					return false;
				}
				throw err;
			});
		if (targetExists) {
			throw new Error(`Já existe uma skill com o slug "${input.newSlug}"`);
		}
	}

	const moved: typeof moves = [];
	try {
		for (const move of moves) {
			await rename(move.source.dir, move.targetDir);
			moved.push(move);
		}

		for (const move of moves) {
			await writeSkillFile(join(move.targetDir, "SKILL.md"), {
				frontmatter: { ...move.source.file.frontmatter, name: input.newSlug },
				body: move.source.file.body,
			});
		}

		const renamed = await getSkillFromFs(input.newSlug, input.projectName);
		if (
			!renamed ||
			renamed.variants.length !== moves.length ||
			renamed.variants.some((variant) => variant.name !== input.newSlug)
		) {
			throw new Error("Não foi possível validar a skill renomeada");
		}

		return renamed;
	} catch (err) {
		for (const move of moved) {
			await Bun.write(join(move.targetDir, "SKILL.md"), move.originalContent).catch(() => {});
		}
		for (const move of moved.toReversed()) {
			await rename(move.targetDir, move.source.dir).catch(() => {});
		}
		throw err;
	}
}

export async function readSkillFileFromFs(input: {
	slug: string;
	projectName?: string;
	variantPath: string;
	relativePath: string;
}) {
	const source = await resolveKnownSkillVariant(input);
	return {
		content: await readSkillDirectoryText({ dir: source.dir, relativePath: input.relativePath }),
	};
}

export async function exportSkillTextFromFs(input: {
	slug: string;
	projectName?: string;
	variantPath: string;
}) {
	const source = await resolveKnownSkillVariant(input);
	return await exportSkillDirectoryText(source.dir);
}

export async function deleteSkillInFs(input: {
	slug: string;
	projectName?: string;
	variantPath: string;
}): Promise<void> {
	const source = await resolveKnownSkillVariant(input);
	await rm(source.dir, { recursive: true, force: true });
}

// Remove a skill de TODAS as fontes onde ela existe (todas as cópias no disco).
export async function deleteAllSkillInFs(input: {
	slug: string;
}): Promise<{ removed: number; backupPath: string }> {
	const loaded = await loadSourcesForSlug(input.slug, await buildDeletableRoots());
	if (loaded.length === 0) {
		throw new Error("Skill não encontrada");
	}

	const backupPath = join(
		SKILL_DELETE_BACKUP_ROOT,
		`${new Date().toISOString().replaceAll(":", "-")}-${input.slug}-${crypto.randomUUID().slice(0, 8)}`,
	);
	const settings = (await dbSkillSettings.getAll()).find((row) => row.slug === input.slug) ?? null;

	await mkdir(backupPath, { recursive: true });
	try {
		for (const [index, source] of loaded.entries()) {
			const target = join(
				backupPath,
				"sources",
				`${String(index + 1).padStart(3, "0")}-${source.root.tool}-${source.root.scope}`,
			);
			await cp(source.manifest.canonicalRoot, target, { recursive: true, dereference: false });
			const copied = await inspectSkillDirectory(target);
			if (copied.hash !== source.manifest.hash) {
				throw new Error(`Falha ao verificar o backup de ${source.dir}`);
			}
		}

		await Bun.write(
			join(backupPath, "manifest.json"),
			JSON.stringify(
				{
					createdAt: new Date().toISOString(),
					slug: input.slug,
					settings,
					sources: loaded.map((source) => ({
						tool: source.root.tool,
						scope: source.root.scope,
						path: source.dir,
						entryType: source.manifest.entryType,
						linkTarget: source.manifest.linkTarget,
						hash: source.manifest.hash,
						contentHash: source.manifest.contentHash,
					})),
				},
				null,
				2,
			),
		);
	} catch (err) {
		await rm(backupPath, { recursive: true, force: true });
		throw err;
	}

	for (const source of loaded) {
		const current = await inspectSkillDirectory(source.dir);
		if (current.hash !== source.manifest.hash) {
			throw new Error(`A skill mudou antes da remoção. Backup preservado em ${backupPath}`);
		}
		await rm(source.dir, { recursive: true, force: true }).catch((err) => {
			throw new Error(`Falha ao remover ${source.dir}. Backup preservado em ${backupPath}`, {
				cause: err,
			});
		});
	}

	return { removed: loaded.length, backupPath };
}
