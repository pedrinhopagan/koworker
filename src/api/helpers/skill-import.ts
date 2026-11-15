import { chmod, cp, lstat, mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { SKILL_SLUG_PATTERN, slugifySkill } from "@/constants/skill-slug";
import { extractFrontmatter, serializeSkillMd } from "@/lib/skills/parser";
import { expandTilde } from "./os-actions";
import { inspectSkillDirectory } from "./skill-directory";
import { getSkillFromFs, installSkillInFs } from "./skills-fs";
import { unzipEntries } from "./unzip";

const STAGING_ROOT = join(tmpdir(), "koworker-skill-import");
const STAGING_TTL_MS = 30 * 60 * 1000;
const DIRECTORY_FILE_LIMIT = 500;
const DIRECTORY_BYTES_LIMIT = 64 * 1024 * 1024;
const IGNORED_NAMES = new Set(["__MACOSX", ".DS_Store", "Thumbs.db", ".git", "node_modules"]);
const INPUT_FOLDER = "entrada";
const GENERIC_FOLDERS = new Set([INPUT_FOLDER, "skill"]);

export type SkillImportSource =
	| { kind: "path"; path: string }
	| { kind: "text"; content: string }
	| { kind: "files"; files: File[]; paths: string[] };

type StagedImport = {
	token: string;
	dir: string;
	skillDir: string;
	origin: string;
	createdAt: number;
};

const staged = new Map<string, StagedImport>();

async function dropExpiredStaging() {
	const now = Date.now();
	for (const [token, entry] of staged) {
		if (now - entry.createdAt > STAGING_TTL_MS) {
			staged.delete(token);
			await rm(entry.dir, { recursive: true, force: true });
		}
	}
}

function normalizeText(content: string) {
	return content.replace(/^﻿/, "").replaceAll("\r\n", "\n");
}

function looksLikePath(content: string) {
	const value = content.trim();
	if (!value || value.includes("\n")) {
		return false;
	}

	return /^(file:\/\/|~\/|\/|[A-Za-z]:[\\/])/.test(value.replaceAll(/^["']|["']$/g, ""));
}

function resolveInputPath(raw: string) {
	let value = raw.trim().replaceAll(/^["']|["']$/g, "");
	if (value.startsWith("file://")) {
		value = decodeURIComponent(new URL(value).pathname);
	}

	return expandTilde(value);
}

function isSkillFileName(name: string) {
	return name.toLowerCase() === "skill.md";
}

function safeRelativePath(raw: string) {
	const segments = raw.replaceAll("\\", "/").split("/").filter(Boolean);
	if (segments.some((segment) => segment === ".." || segment === "." || segment.includes("\0"))) {
		throw new Error(`Caminho inválido: ${raw}`);
	}

	return segments.join("/");
}

async function writeEntries(
	dir: string,
	entries: { path: string; data: Uint8Array; mode?: number }[],
) {
	for (const entry of entries) {
		const path = safeRelativePath(entry.path);
		if (!path || path.split("/").some((segment) => IGNORED_NAMES.has(segment))) {
			continue;
		}
		const target = join(dir, ...path.split("/"));
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, entry.data);
		if (entry.mode) {
			await chmod(target, entry.mode | 0o600);
		}
	}
}

function parseTextBundle(content: string) {
	const bytes = new TextEncoder().encode(content);
	const decoder = new TextDecoder();
	const header = /^===== ("(?:[^"\\]|\\.)*") (\d+) =====\n/;
	const entries: { path: string; data: Uint8Array }[] = [];
	let offset = 0;

	while (offset < bytes.length) {
		const rest = decoder.decode(bytes.subarray(offset, offset + 4096));
		const match = rest.match(header);
		if (!match) {
			return null;
		}
		const start = offset + new TextEncoder().encode(match[0]).length;
		const size = Number(match[2]);
		entries.push({
			path: JSON.parse(match[1]) as string,
			data: bytes.subarray(start, start + size),
		});
		offset = start + size;
		while (offset < bytes.length && bytes[offset] === 10) {
			offset += 1;
		}
	}

	return entries.length > 0 ? entries : null;
}

async function copyDirectoryLimited(source: string, target: string) {
	let files = 0;
	let bytes = 0;

	async function visit(current: string) {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			if (IGNORED_NAMES.has(entry.name)) {
				continue;
			}
			const path = join(current, entry.name);
			const info = await stat(path);
			if (info.isDirectory()) {
				await visit(path);
				continue;
			}
			files += 1;
			bytes += info.size;
			if (files > DIRECTORY_FILE_LIMIT || bytes > DIRECTORY_BYTES_LIMIT) {
				throw new Error(
					`A pasta ${source} é grande demais para uma skill (limite de ${DIRECTORY_FILE_LIMIT} arquivos e 64 MiB)`,
				);
			}
		}
	}

	await visit(source);
	await cp(source, target, {
		recursive: true,
		dereference: true,
		filter: (path) => !IGNORED_NAMES.has(basename(path)),
	});
}

async function stageFromPath(raw: string, dir: string) {
	const path = resolveInputPath(raw);
	const info = await stat(path).catch(() => null);
	if (!info) {
		throw new Error(`Caminho não encontrado: ${path}`);
	}

	if (info.isDirectory()) {
		const found = await findSkillDirs(path);
		if (found.length > 1) {
			throw new Error(
				`A pasta tem ${found.length} skills (${found.map((item) => basename(item)).join(", ")}). Aponte para uma delas`,
			);
		}
		const skillDir = found[0] ?? path;
		await copyDirectoryLimited(skillDir, join(dir, basename(skillDir) || "skill"));
		return path;
	}

	if (extname(path).toLowerCase() === ".zip") {
		await writeEntries(
			join(dir, basename(path, extname(path))),
			unzipEntries(await Bun.file(path).bytes()),
		);
		return path;
	}

	if (isSkillFileName(basename(path))) {
		await copyDirectoryLimited(dirname(path), join(dir, basename(dirname(path)) || "skill"));
		return path;
	}

	if (extname(path).toLowerCase() === ".md") {
		const folder = join(dir, basename(path, extname(path)));
		await mkdir(folder, { recursive: true });
		await writeFile(join(folder, "SKILL.md"), await Bun.file(path).bytes());
		return path;
	}

	throw new Error("Aponte para um SKILL.md, um .md, uma pasta de skill ou um .zip");
}

async function stageFromText(content: string, dir: string) {
	if (looksLikePath(content)) {
		return await stageFromPath(content, dir);
	}

	const text = normalizeText(content);
	const bundle = parseTextBundle(text);
	if (bundle) {
		await writeEntries(join(dir, "skill"), bundle);
		return "texto colado";
	}

	await mkdir(join(dir, "skill"), { recursive: true });
	await writeFile(join(dir, "skill", "SKILL.md"), text);
	return "texto colado";
}

async function stageFromFiles(files: File[], paths: string[], dir: string) {
	if (files.length === 1 && extname(files[0].name).toLowerCase() === ".zip") {
		await writeEntries(
			join(dir, basename(files[0].name, extname(files[0].name))),
			unzipEntries(new Uint8Array(await files[0].arrayBuffer())),
		);
		return files[0].name;
	}

	if (files.length === 1 && extname(files[0].name).toLowerCase() === ".md") {
		const name = isSkillFileName(files[0].name) ? "skill" : basename(files[0].name, ".md");
		await mkdir(join(dir, name), { recursive: true });
		await writeFile(join(dir, name, "SKILL.md"), new Uint8Array(await files[0].arrayBuffer()));
		return files[0].name;
	}

	const entries = await Promise.all(
		files.map(async (file, index) => ({
			path: paths[index] || file.name,
			data: new Uint8Array(await file.arrayBuffer()),
		})),
	);
	const total = entries.reduce((sum, entry) => sum + entry.data.length, 0);
	if (entries.length > DIRECTORY_FILE_LIMIT || total > DIRECTORY_BYTES_LIMIT) {
		throw new Error("Arquivos demais para uma skill (limite de 500 arquivos e 64 MiB)");
	}
	await writeEntries(dir, entries);
	return paths[0]?.split("/")[0] || files[0]?.name || "arquivos";
}

async function findSkillDirs(dir: string, depth = 0): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	if (entries.some((entry) => entry.isFile() && isSkillFileName(entry.name))) {
		return [dir];
	}
	if (depth >= 3) {
		return [];
	}

	const nested = await Promise.all(
		entries
			.filter((entry) => entry.isDirectory() && !IGNORED_NAMES.has(entry.name))
			.map((entry) => findSkillDirs(join(dir, entry.name), depth + 1)),
	);

	return nested.flat();
}

async function locateSkillDir(dir: string) {
	const found = await findSkillDirs(dir);
	if (found.length > 1) {
		throw new Error(
			`Encontrei ${found.length} skills (${found.map((path) => basename(path)).join(", ")}). Importe uma por vez`,
		);
	}
	if (found.length === 1) {
		const skillDir = found[0];
		const entries = await readdir(skillDir);
		const actual = entries.find(isSkillFileName);
		if (actual && actual !== "SKILL.md") {
			await rename(join(skillDir, actual), join(skillDir, "SKILL.md"));
		}
		return skillDir;
	}

	const markdown: string[] = [];
	async function collect(current: string, depth: number) {
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const path = join(current, entry.name);
			if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
				markdown.push(path);
			}
			if (entry.isDirectory() && depth < 1) {
				await collect(path, depth + 1);
			}
		}
	}
	await collect(dir, 0);
	if (markdown.length === 1) {
		await rename(markdown[0], join(dirname(markdown[0]), "SKILL.md"));
		return dirname(markdown[0]);
	}

	throw new Error("Nenhum SKILL.md encontrado no que foi enviado");
}

function firstParagraph(body: string) {
	return (
		body
			.split(/\n\s*\n/)
			.map((block) => block.trim())
			.find((block) => block && !block.startsWith("#") && !block.startsWith("```"))
			?.replaceAll(/\s+/g, " ")
			.slice(0, 280) ?? ""
	);
}

function firstHeading(body: string) {
	return body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
}

async function describeStaged(entry: StagedImport) {
	const raw = normalizeText(await Bun.file(join(entry.skillDir, "SKILL.md")).text());
	const extracted = extractFrontmatter(raw);
	const frontmatter = extracted?.frontmatter ?? {};
	const body = extracted?.body ?? raw.trim();
	const frontmatterName = typeof frontmatter.name === "string" ? frontmatter.name.trim() : "";
	const folderName = GENERIC_FOLDERS.has(basename(entry.skillDir)) ? "" : basename(entry.skillDir);
	const title = typeof frontmatter.title === "string" ? frontmatter.title.trim() : "";
	const slug =
		[frontmatterName, folderName, title, firstHeading(body)]
			.map(slugifySkill)
			.find((candidate) => candidate && SKILL_SLUG_PATTERN.test(candidate)) ?? "";
	const description =
		typeof frontmatter.description === "string" && frontmatter.description.trim()
			? frontmatter.description.trim()
			: firstParagraph(body);
	const manifest = await inspectSkillDirectory(entry.skillDir);

	return {
		token: entry.token,
		origin: entry.origin,
		slug,
		description,
		hasFrontmatter: !!extracted,
		files: manifest.files.map((file) => ({ path: file.path, size: file.size, kind: file.kind })),
		existing: slug ? !!(await getSkillFromFs(slug)) : false,
	};
}

export async function previewSkillImport(source: SkillImportSource) {
	await dropExpiredStaging();
	const token = crypto.randomUUID();
	const dir = join(STAGING_ROOT, token, INPUT_FOLDER);
	await mkdir(dir, { recursive: true });

	try {
		const origin =
			source.kind === "path"
				? await stageFromPath(source.path, dir)
				: source.kind === "text"
					? await stageFromText(source.content, dir)
					: await stageFromFiles(source.files, source.paths, dir);
		const entry: StagedImport = {
			token,
			dir: join(STAGING_ROOT, token),
			skillDir: await locateSkillDir(dir),
			origin,
			createdAt: Date.now(),
		};
		staged.set(token, entry);
		return await describeStaged(entry);
	} catch (err) {
		await rm(join(STAGING_ROOT, token), { recursive: true, force: true });
		throw err;
	}
}

export async function checkSkillImportSlug(slug: string) {
	return { existing: !!(await getSkillFromFs(slug)) };
}

export async function commitSkillImport(input: {
	token: string;
	slug: string;
	description: string;
	replace: boolean;
}) {
	const entry = staged.get(input.token);
	if (!entry) {
		throw new Error("A importação expirou. Envie a skill de novo");
	}
	if (!SKILL_SLUG_PATTERN.test(input.slug)) {
		throw new Error("Slug deve conter apenas letras minúsculas, números e hífens");
	}
	if (!input.description.trim()) {
		throw new Error("Informe uma descrição para a skill");
	}

	const prepared = join(entry.dir, "pronta", input.slug);
	await rm(join(entry.dir, "pronta"), { recursive: true, force: true });
	await mkdir(dirname(prepared), { recursive: true });
	await cp(entry.skillDir, prepared, { recursive: true });

	const skillPath = join(prepared, "SKILL.md");
	const raw = normalizeText(await Bun.file(skillPath).text());
	const extracted = extractFrontmatter(raw);
	await Bun.write(
		skillPath,
		serializeSkillMd({
			frontmatter: {
				...extracted?.frontmatter,
				name: input.slug,
				description: input.description.trim(),
			},
			body: extracted?.body ?? raw.trim(),
		}),
	);

	const stats = await lstat(prepared);
	if (!stats.isDirectory()) {
		throw new Error("Falha ao preparar a skill para instalação");
	}

	try {
		const result = await installSkillInFs({ sourceDir: prepared, replace: input.replace });
		staged.delete(input.token);
		await rm(entry.dir, { recursive: true, force: true });
		return result;
	} catch (err) {
		await rm(join(entry.dir, "pronta"), { recursive: true, force: true });
		throw err;
	}
}

export async function cancelSkillImport(token: string) {
	const entry = staged.get(token);
	if (!entry) {
		return;
	}
	staged.delete(token);
	await rm(entry.dir, { recursive: true, force: true });
}
