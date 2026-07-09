import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import {
	DOC_MIME_BY_EXT,
	EXT_BY_IMAGE_MIME,
	IMAGE_MIME_BY_EXT,
	MEDIAS_DIRNAME,
} from "@/constants/koworker";
import { djs } from "./dayjs";

const KOWORKER_DIR = ".koworker";

// Metadados de um asset (não-texto) — nome, tamanho, mtime e o MIME que o front usa pra escolher o
// modo de render. Sem conteúdo: os bytes viajam só quando um arquivo é aberto, via readAssetFile.
export type AssetFileMeta = {
	name: string;
	size: number;
	mtime: number;
	mime: string;
};

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
	dir: string,
	name: string,
	mimeByExt: Record<string, string>,
): Promise<File | null> {
	const mime = mimeForAsset(name, mimeByExt);
	if (!mime) return null;

	const file = Bun.file(join(dir, name));
	if (!(await file.exists())) return null;

	return new File([await file.arrayBuffer()], name, { type: mime });
}

async function assertFree(dir: string, name: string): Promise<void> {
	const exists = await stat(join(dir, name))
		.then(() => true)
		.catch(() => false);
	if (exists) throw new Error(`Já existe um arquivo "${name}" nesta pasta`);
}

// ---------- medias/ (mídia solta do projeto) ----------

export function listMediaFiles(projectRoute: string): Promise<AssetFileMeta[]> {
	return listAssetsIn(mediasDir(projectRoute), IMAGE_MIME_BY_EXT);
}

export function readMediaFile(params: {
	projectRoute: string;
	name: string;
}): Promise<File | null> {
	return readAssetFile(mediasDir(params.projectRoute), params.name, IMAGE_MIME_BY_EXT);
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

	const stats = await stat(join(dir, name));
	return { name, mime: params.file.type, size: stats.size, mtime: stats.mtimeMs };
}

export async function deleteMediaFile(params: {
	projectRoute: string;
	name: string;
}): Promise<void> {
	await rm(join(mediasDir(params.projectRoute), params.name), { force: true });
}

export async function renameMediaFile(params: {
	projectRoute: string;
	oldName: string;
	newName: string;
}): Promise<void> {
	const dir = mediasDir(params.projectRoute);
	await assertFree(dir, params.newName);
	await rename(join(dir, params.oldName), join(dir, params.newName));
}

// ---------- artefatos soltos na pasta da tarefa ----------

// Artefatos "robustos" da pasta da tarefa: só HTML/PDF. É o que o mostruário considera artefato,
// então a whitelist DOC_MIME_BY_EXT filtra tudo o mais.
export function listTaskArtifacts(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<AssetFileMeta[]> {
	return listAssetsIn(join(params.projectRoute, params.folderPath), DOC_MIME_BY_EXT);
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
