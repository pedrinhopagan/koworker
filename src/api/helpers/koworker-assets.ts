import { mkdir, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";

import {
	DOC_MIME_BY_EXT,
	EXT_BY_IMAGE_MIME,
	IMAGE_MIME_BY_EXT,
	MEDIAS_DIRNAME,
} from "@/constants/koworker";
import { djs } from "./dayjs";
import { createFolderCache } from "./folder-cache";

// No binário compilado (`bun build --compile`), o addon do sharp é embutido mas seu rpath relativo
// não encontra o libvips fora do node_modules. Pré-carregar o .so do vendor (instalado pelos
// scripts de deploy) satisfaz o dlopen; em dev o vendor não existe e o rpath resolve sozinho.
// Só o require CJS funciona no compilado — o caminho ESM do sharp não embute o .node.
const SHARP_VENDOR_LIBVIPS_DIR = join(
	homedir(),
	".local/lib/kowork/vendor/node_modules/@img/sharp-libvips-linux-x64/lib",
);

let sharpPromise: Promise<typeof import("sharp").default> | undefined;

async function preloadVendorLibvips() {
	const soname = (await readdir(SHARP_VENDOR_LIBVIPS_DIR).catch(() => [])).find((name) =>
		name.startsWith("libvips-cpp.so"),
	);
	if (!soname) return;

	const { dlopen } = await import("bun:ffi");
	dlopen(join(SHARP_VENDOR_LIBVIPS_DIR, soname), {
		vips_version: { args: ["int"], returns: "int" },
	});
}

async function loadSharp() {
	await preloadVendorLibvips().catch(() => {});

	const mod = require("sharp");
	const sharp = (mod.default ?? mod) as typeof import("sharp").default;
	sharp.cache(false);
	sharp.concurrency(2);

	return sharp;
}

async function getSharp() {
	sharpPromise ??= loadSharp();

	return await sharpPromise;
}

const KOWORKER_DIR = ".koworker";

// Metadados de um asset (não-texto) — nome, tamanho, mtime e o MIME que o front usa pra escolher o
// modo de render. Sem conteúdo: os bytes viajam só quando um arquivo é aberto, via readAssetFile.
export type AssetFileMeta = {
	name: string;
	size: number;
	mtime: number;
	mime: string;
};

export type TaskArtifactMeta = AssetFileMeta & {
	metadata: {
		title: string | null;
		subtitle: string | null;
		headings: string[];
	} | null;
};

const ARTIFACT_METADATA_CACHE_MAX = 512;
const artifactMetadataCache = new Map<
	string,
	{
		mtime: number;
		size: number;
		metadata: Promise<TaskArtifactMeta["metadata"]>;
	}
>();
const MEDIA_PREVIEW_CACHE_MAX = 64;
const MEDIA_PREVIEW_CONCURRENCY = 2;
const MEDIA_FILES_TTL_MS = 30_000;
const mediaPreviewQueue: (() => void)[] = [];
const mediaFilesCache = createFolderCache<AssetFileMeta[]>(MEDIA_FILES_TTL_MS);
let activeMediaPreviews = 0;

async function createMediaPreview(path: string) {
	if (activeMediaPreviews >= MEDIA_PREVIEW_CONCURRENCY) {
		await new Promise<void>((resolve) => {
			mediaPreviewQueue.push(resolve);
		});
	}

	activeMediaPreviews++;

	try {
		const sharp = await getSharp();
		const output = await sharp(path)
			.rotate()
			.resize({ width: 480, height: 360, fit: "cover", position: "north" })
			.webp({ quality: 78 })
			.toBuffer();
		const bytes = new Uint8Array(output.length);
		bytes.set(output);

		return bytes.buffer;
	} finally {
		activeMediaPreviews--;
		mediaPreviewQueue.shift()?.();
	}
}

const mediaPreviewCache = new Map<string, ArrayBuffer>();
const mediaPreviewInflight = new Map<string, ReturnType<typeof createMediaPreview>>();

function mediaFilesCacheKey(dir: string) {
	return `media-files\0${dir}`;
}

export function invalidateMediaFilesCache(dir: string): void {
	mediaFilesCache.deletePrefix(mediaFilesCacheKey(dir));
}

// MIME de um nome de arquivo pela extensão dentro da whitelist do destino, ou null quando a extensão
// não pertence a ele — o que também serve de filtro: `medias/` passa IMAGE_MIME_BY_EXT (só imagens)
// e a pasta da tarefa passa DOC_MIME_BY_EXT (só HTML/PDF), então cada pasta só lista e só lê o seu
// próprio tipo.
function mimeForAsset(name: string, mimeByExt: Record<string, string>): string | null {
	const dot = name.lastIndexOf(".");
	if (dot < 0) return null;
	return mimeByExt[name.slice(dot).toLowerCase()] ?? null;
}

function mediasDir(projectRoute: string): string {
	return join(projectRoute, KOWORKER_DIR, MEDIAS_DIRNAME);
}

function isInside(root: string, target: string) {
	return target === root || target.startsWith(root + sep);
}

async function resolveAssetDir(projectRoute: string, dir: string) {
	const [projectRoot, koworkerRoot, assetDir] = await Promise.all([
		realpath(projectRoute).catch(() => null),
		realpath(join(projectRoute, KOWORKER_DIR)).catch(() => null),
		realpath(dir).catch(() => null),
	]);

	if (
		!projectRoot ||
		!koworkerRoot ||
		!assetDir ||
		!isInside(projectRoot, koworkerRoot) ||
		!isInside(koworkerRoot, assetDir)
	) {
		return null;
	}

	return assetDir;
}

async function resolveAssetFile(
	projectRoute: string,
	dir: string,
	name: string,
	mimeByExt: Record<string, string>,
) {
	const mime = mimeForAsset(name, mimeByExt);
	if (!mime) return null;

	const assetDir = await resolveAssetDir(projectRoute, dir);
	if (!assetDir) return null;

	const path = await realpath(join(assetDir, name)).catch(() => null);
	if (!path || !isInside(assetDir, path)) return null;

	const stats = await stat(path).catch(() => null);
	if (!stats?.isFile()) return null;

	return { mime, mtime: stats.mtimeMs, path, size: stats.size };
}

async function readCachedMediaPreview(path: string, mtime: number, size: number) {
	const key = `${path}\0${mtime}\0${size}`;
	const cached = mediaPreviewCache.get(key);
	if (cached) {
		mediaPreviewCache.delete(key);
		mediaPreviewCache.set(key, cached);

		return cached;
	}

	const inflight = mediaPreviewInflight.get(key);
	if (inflight) {
		return await inflight;
	}

	const preview = createMediaPreview(path);
	mediaPreviewInflight.set(key, preview);
	void preview.then(
		(value) => {
			if (mediaPreviewInflight.get(key) !== preview) return;

			mediaPreviewInflight.delete(key);
			mediaPreviewCache.set(key, value);
			if (mediaPreviewCache.size > MEDIA_PREVIEW_CACHE_MAX) {
				const oldestKey = mediaPreviewCache.keys().next().value;
				if (oldestKey) {
					mediaPreviewCache.delete(oldestKey);
				}
			}
		},
		() => {
			if (mediaPreviewInflight.get(key) === preview) {
				mediaPreviewInflight.delete(key);
			}
		},
	);

	return await preview;
}

// Metadata-only dos assets direto numa pasta (não recursivo), do mais recente pro mais antigo.
// Pasta inexistente vira lista vazia. `mimeByExt` é a whitelist do destino: ignora `.md` e qualquer
// extensão fora dela (um PDF numa pasta de mídia, uma imagem no mostruário).
async function listAssetsIn(
	dir: string,
	mimeByExt: Record<string, string>,
): Promise<AssetFileMeta[]> {
	const named = (await readdir(dir, { withFileTypes: true }).catch(() => []))
		.filter((entry) => entry.isFile())
		.map((entry) => ({ name: entry.name, mime: mimeForAsset(entry.name, mimeByExt) }))
		.filter((entry): entry is { name: string; mime: string } => entry.mime !== null);

	const metas = await Promise.all(
		named.map(async ({ name, mime }) => {
			const stats = await stat(join(dir, name)).catch(() => null);
			return { name, mime, size: stats?.size ?? 0, mtime: stats?.mtimeMs ?? 0 };
		}),
	);

	return metas.sort((a, b) => b.mtime - a.mtime);
}

// Bytes de um asset como File (nome + MIME), pronto pro oRPC transportar como Blob. null quando a
// extensão está fora da whitelist do destino ou o arquivo não existe — a rota trata como "não
// encontrado", então uma rota nunca serve o tipo da outra mesmo se o nome for adivinhado.
async function readAssetFile(
	projectRoute: string,
	dir: string,
	name: string,
	mimeByExt: Record<string, string>,
): Promise<File | null> {
	const asset = await resolveAssetFile(projectRoute, dir, name, mimeByExt);
	if (!asset) return null;

	const file = Bun.file(asset.path);

	return new File([await file.arrayBuffer()], name, { type: asset.mime });
}

async function readAssetPreview(
	projectRoute: string,
	dir: string,
	name: string,
	mimeByExt: Record<string, string>,
): Promise<File | null> {
	const asset = await resolveAssetFile(projectRoute, dir, name, mimeByExt);
	if (!asset) return null;

	return new File(
		[await readCachedMediaPreview(asset.path, asset.mtime, asset.size)],
		name.replace(/\.[^.]+$/, ".webp"),
		{ type: "image/webp" },
	);
}

async function assertFree(dir: string, name: string): Promise<void> {
	const exists = await stat(join(dir, name))
		.then(() => true)
		.catch(() => false);
	if (exists) throw new Error(`Já existe um arquivo "${name}" nesta pasta`);
}

// ---------- medias/ (mídia solta do projeto) ----------

export async function listMediaFiles(projectRoute: string): Promise<AssetFileMeta[]> {
	const dir = mediasDir(projectRoute);
	const resolvedDir = await resolveAssetDir(projectRoute, dir);
	if (!resolvedDir) return [];

	return await mediaFilesCache.get(mediaFilesCacheKey(dir), () =>
		listAssetsIn(resolvedDir, IMAGE_MIME_BY_EXT),
	);
}

export function readMediaFile(params: {
	projectRoute: string;
	name: string;
}): Promise<File | null> {
	return readAssetFile(
		params.projectRoute,
		mediasDir(params.projectRoute),
		params.name,
		IMAGE_MIME_BY_EXT,
	);
}

export function readMediaPreview(params: {
	projectRoute: string;
	name: string;
}): Promise<File | null> {
	return readAssetPreview(
		params.projectRoute,
		mediasDir(params.projectRoute),
		params.name,
		IMAGE_MIME_BY_EXT,
	);
}

export async function listTaskMediaFiles(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<AssetFileMeta[]> {
	const dir = join(params.projectRoute, params.folderPath);
	const resolvedDir = await resolveAssetDir(params.projectRoute, dir);
	if (!resolvedDir) return [];

	return await mediaFilesCache.get(mediaFilesCacheKey(dir), () =>
		listAssetsIn(resolvedDir, IMAGE_MIME_BY_EXT),
	);
}

export function readTaskMediaFile(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
}): Promise<File | null> {
	return readAssetFile(
		params.projectRoute,
		join(params.projectRoute, params.folderPath),
		params.name,
		IMAGE_MIME_BY_EXT,
	);
}

export function readTaskMediaPreview(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
}): Promise<File | null> {
	return readAssetPreview(
		params.projectRoute,
		join(params.projectRoute, params.folderPath),
		params.name,
		IMAGE_MIME_BY_EXT,
	);
}

// Grava uma imagem vinda do clipboard em `.koworker/medias/`. O clipboard não traz nome: o arquivo
// nasce como `imagem-<timestamp>` com a extensão do MIME, e colisões (várias colas no mesmo segundo)
// ganham sufixo numérico. Devolve a meta lida de volta do disco — o que o front registra é o que o
// FS confirmou, não o que foi pedido.
export async function saveMediaFile(params: {
	projectRoute: string;
	file: File;
}): Promise<AssetFileMeta> {
	const ext = EXT_BY_IMAGE_MIME[params.file.type];
	if (!ext) throw new Error(`Tipo de imagem não suportado: ${params.file.type || "desconhecido"}`);

	const dir = mediasDir(params.projectRoute);
	await mkdir(dir, { recursive: true });

	const base = `imagem-${djs().format("YYYY-MM-DD-HHmmss")}`;
	let name = `${base}${ext}`;
	for (let attempt = 2; await Bun.file(join(dir, name)).exists(); attempt++) {
		name = `${base}-${attempt}${ext}`;
	}

	await Bun.write(join(dir, name), params.file);
	invalidateMediaFilesCache(dir);

	const stats = await stat(join(dir, name));
	return { name, mime: params.file.type, size: stats.size, mtime: stats.mtimeMs };
}

export async function deleteMediaFile(params: {
	projectRoute: string;
	name: string;
}): Promise<void> {
	const dir = mediasDir(params.projectRoute);
	await rm(join(dir, params.name), { force: true });
	invalidateMediaFilesCache(dir);
}

export async function renameMediaFile(params: {
	projectRoute: string;
	oldName: string;
	newName: string;
}): Promise<void> {
	const dir = mediasDir(params.projectRoute);
	await assertFree(dir, params.newName);
	await rename(join(dir, params.oldName), join(dir, params.newName));
	invalidateMediaFilesCache(dir);
}

// ---------- artefatos soltos na pasta da tarefa ----------

// Artefatos "robustos" da pasta da tarefa: só HTML/PDF. É o que o mostruário considera artefato,
// então a whitelist DOC_MIME_BY_EXT filtra tudo o mais.
function decodeHtmlText(value: string): string {
	const named = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' } as const;

	return value
		.replaceAll(/&#(?:x([\da-f]+)|(\d+));/gi, (entity, hex, decimal) => {
			const code = hex ? Number.parseInt(hex, 16) : Number(decimal);
			return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
		})
		.replaceAll(
			/&(amp|apos|gt|lt|quot);/gi,
			(_entity, name) => named[name.toLowerCase() as keyof typeof named],
		)
		.replaceAll(/\s+/g, " ")
		.trim();
}

async function readArtifactMetadata(path: string) {
	const source = await Bun.file(path)
		.slice(0, 64 * 1024)
		.text();
	const metadata = { title: "", subtitle: "", headings: [] as string[] };

	const rewriter = new HTMLRewriter()
		.on("title", {
			text(chunk) {
				metadata.title += chunk.text;
			},
		})
		.on('meta[name="description"]', {
			element(element) {
				metadata.subtitle = element.getAttribute("content") ?? "";
			},
		})
		.on('meta[name="koworker:heading"]', {
			element(element) {
				const value = element.getAttribute("content");
				if (value && metadata.headings.length < 6) {
					metadata.headings.push(value);
				}
			},
		});

	await rewriter.transform(new Response(source)).text();

	const parsed = {
		title: decodeHtmlText(metadata.title) || null,
		subtitle: decodeHtmlText(metadata.subtitle) || null,
		headings: metadata.headings.map(decodeHtmlText).filter((heading) => heading !== ""),
	};

	if (!parsed.title && !parsed.subtitle && parsed.headings.length === 0) {
		return null;
	}

	return parsed;
}

function readCachedArtifactMetadata(path: string, artifact: AssetFileMeta) {
	const cached = artifactMetadataCache.get(path);
	if (cached && cached.mtime === artifact.mtime && cached.size === artifact.size) {
		return cached.metadata;
	}

	const metadata = readArtifactMetadata(path);
	artifactMetadataCache.set(path, {
		mtime: artifact.mtime,
		size: artifact.size,
		metadata,
	});
	void metadata.catch(() => {
		if (artifactMetadataCache.get(path)?.metadata === metadata) {
			artifactMetadataCache.delete(path);
		}
	});
	if (artifactMetadataCache.size > ARTIFACT_METADATA_CACHE_MAX) {
		const oldestPath = artifactMetadataCache.keys().next().value;
		if (oldestPath) {
			artifactMetadataCache.delete(oldestPath);
		}
	}
	return metadata;
}

export async function listTaskArtifacts(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<TaskArtifactMeta[]> {
	const dir = join(params.projectRoute, params.folderPath);
	const artifacts = await listAssetsIn(dir, DOC_MIME_BY_EXT);

	return Promise.all(
		artifacts.map(async (artifact) =>
			Object.assign(artifact, {
				metadata:
					artifact.mime === "text/html"
						? await readCachedArtifactMetadata(join(dir, artifact.name), artifact)
						: null,
			}),
		),
	);
}

// Anexos da tarefa: qualquer arquivo da pasta que não seja `.md` (os `.md` são as abas de texto,
// exibidas à parte). Diferente de listTaskArtifacts, não filtra por extensão — o MIME vem de
// DOC_MIME_BY_EXT quando conhecido e cai em `application/octet-stream` no resto. Alimenta os cards
// de anexo do getFull; o mostruário continua usando listTaskArtifacts (só HTML/PDF).
export async function listTaskAttachments(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<AssetFileMeta[]> {
	const dir = join(params.projectRoute, params.folderPath);

	const names = (await readdir(dir, { withFileTypes: true }).catch(() => []))
		.filter((entry) => entry.isFile() && !entry.name.toLowerCase().endsWith(".md"))
		.map((entry) => entry.name);

	const metas = await Promise.all(
		names.map(async (name) => {
			const dot = name.lastIndexOf(".");
			const ext = dot < 0 ? "" : name.slice(dot).toLowerCase();
			const mime = DOC_MIME_BY_EXT[ext] ?? "application/octet-stream";
			const stats = await stat(join(dir, name)).catch(() => null);
			return { name, mime, size: stats?.size ?? 0, mtime: stats?.mtimeMs ?? 0 };
		}),
	);

	return metas.sort((a, b) => b.mtime - a.mtime);
}
