import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import {
	DOC_MIME_BY_EXT,
	IMAGE_MIME_BY_EXT,
	MEDIAS_DIRNAME,
	MOSTRUARIO_DIRNAME,
} from "@/constants/koworker";

const KOWORKER_DIR = ".koworker";

// Metadados de um asset (não-texto) — nome, tamanho, mtime e o MIME que o front usa pra escolher o
// modo de render. Sem conteúdo: os bytes viajam só quando um arquivo é aberto, via readAssetFile.
export type AssetFileMeta = {
	name: string;
	size: number;
	mtime: number;
	mime: string;
};

// Artefatos de uma pasta de mostruário, agrupados pela subpasta do id curto da tarefa.
export type MostruarioFolder = {
	taskFolder: string;
	files: AssetFileMeta[];
};

// MIME de um nome de arquivo pela extensão dentro da whitelist do destino, ou null quando a extensão
// não pertence a ele — o que também serve de filtro: `medias/` passa IMAGE_MIME_BY_EXT (só imagens)
// e `mostruario/`/tarefa passam DOC_MIME_BY_EXT (só HTML/PDF), então cada pasta só lista e só lê o
// seu próprio tipo.
function mimeForAsset(name: string, mimeByExt: Record<string, string>): string | null {
	const dot = name.lastIndexOf(".");
	if (dot < 0) return null;
	return mimeByExt[name.slice(dot).toLowerCase()] ?? null;
}

function mediasDir(projectRoute: string): string {
	return join(projectRoute, KOWORKER_DIR, MEDIAS_DIRNAME);
}

function mostruarioDir(projectRoute: string): string {
	return join(projectRoute, KOWORKER_DIR, MOSTRUARIO_DIRNAME);
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

// Remove a subpasta do id curto quando fica sem nenhum asset — o mostruário some da listagem
// quando o último artefato da tarefa é apagado ou movido de volta.
async function removeIfEmpty(dir: string): Promise<void> {
	const remaining = await readdir(dir).catch(() => null);
	if (remaining && remaining.length === 0) {
		await rm(dir, { recursive: true, force: true });
	}
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

// ---------- mostruario/<id>/ (artefatos robustos por tarefa) ----------

export async function listMostruarioFolders(projectRoute: string): Promise<MostruarioFolder[]> {
	const root = mostruarioDir(projectRoute);

	const taskFolders = (await readdir(root, { withFileTypes: true }).catch(() => []))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);

	const folders = await Promise.all(
		taskFolders.map(async (taskFolder) => ({
			taskFolder,
			files: await listAssetsIn(join(root, taskFolder), DOC_MIME_BY_EXT),
		})),
	);

	return folders
		.filter((folder) => folder.files.length > 0)
		.sort((a, b) => maxMtime(b.files) - maxMtime(a.files));
}

export function readMostruarioFile(params: {
	projectRoute: string;
	taskFolder: string;
	name: string;
}): Promise<File | null> {
	return readAssetFile(
		join(mostruarioDir(params.projectRoute), params.taskFolder),
		params.name,
		DOC_MIME_BY_EXT,
	);
}

export async function deleteMostruarioFile(params: {
	projectRoute: string;
	taskFolder: string;
	name: string;
}): Promise<void> {
	const dir = join(mostruarioDir(params.projectRoute), params.taskFolder);
	await rm(join(dir, params.name), { force: true });
	await removeIfEmpty(dir);
}

export async function renameMostruarioFile(params: {
	projectRoute: string;
	taskFolder: string;
	oldName: string;
	newName: string;
}): Promise<void> {
	const dir = join(mostruarioDir(params.projectRoute), params.taskFolder);
	await assertFree(dir, params.newName);
	await rename(join(dir, params.oldName), join(dir, params.newName));
}

// ---------- artefatos ainda dentro da pasta da tarefa ----------

export function listTaskArtifacts(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<AssetFileMeta[]> {
	return listAssetsIn(join(params.projectRoute, params.folderPath), DOC_MIME_BY_EXT);
}

export function readTaskArtifact(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
}): Promise<File | null> {
	return readAssetFile(join(params.projectRoute, params.folderPath), params.name, DOC_MIME_BY_EXT);
}

// Move os artefatos da pasta da tarefa pra `mostruario/<id>/`, sob a subpasta do mesmo id curto
// (basename do folder_path) — é o id compartilhado que liga tarefa e mostruário. Trata o par de
// mesmo basename (ex.: apresentacao.html + apresentacao.pdf) como unidade: se o destino já tem esse
// basename, sufixa o grupo inteiro junto (apresentacao-2.html + apresentacao-2.pdf), nunca por
// arquivo — senão o HTML e o PDF do mesmo deck ganhariam sufixos divergentes. `names` restringe a
// arquivos específicos; ausente move todos os artefatos. Rename atômico (mesmo `.koworker/`).
export async function moveTaskArtifactsToMostruario(params: {
	projectRoute: string;
	taskFolderPath: string;
	names?: string[];
}): Promise<{ moved: string[] }> {
	const srcDir = join(params.projectRoute, params.taskFolderPath);
	const destDir = join(mostruarioDir(params.projectRoute), basename(params.taskFolderPath));

	const all = await listAssetsIn(srcDir, DOC_MIME_BY_EXT);
	const chosen = params.names ? all.filter((asset) => params.names?.includes(asset.name)) : all;
	if (chosen.length === 0) return { moved: [] };

	await mkdir(destDir, { recursive: true });

	const groups = groupByBasename(chosen.map((asset) => asset.name));

	const moved: string[] = [];
	for (const [base, exts] of groups) {
		const suffix = await freeSuffix(destDir, base, exts);
		for (const ext of exts) {
			const finalName = `${base}${suffix}${ext}`;
			await rename(join(srcDir, `${base}${ext}`), join(destDir, finalName));
			moved.push(finalName);
		}
	}

	return { moved };
}

function groupByBasename(names: string[]): Map<string, string[]> {
	const groups = new Map<string, string[]>();
	for (const name of names) {
		const dot = name.lastIndexOf(".");
		const base = name.slice(0, dot);
		const ext = name.slice(dot);
		groups.set(base, [...(groups.get(base) ?? []), ext]);
	}
	return groups;
}

// Menor sufixo ("" , "-2", "-3"...) tal que nenhuma das extensões do grupo colida no destino.
async function freeSuffix(destDir: string, base: string, exts: string[]): Promise<string> {
	for (let i = 1; ; i++) {
		const suffix = i === 1 ? "" : `-${i}`;
		const collisions = await Promise.all(
			exts.map((ext) =>
				stat(join(destDir, `${base}${suffix}${ext}`))
					.then(() => true)
					.catch(() => false),
			),
		);
		if (!collisions.some(Boolean)) return suffix;
	}
}

function maxMtime(files: AssetFileMeta[]): number {
	return files.reduce((max, file) => Math.max(max, file.mtime), 0);
}
