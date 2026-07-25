import { lstat, mkdir, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { RESERVED_KOWORKER_FOLDERS } from "@/constants/koworker";
import { createFolderCache, invalidateFolderPrefix } from "./folder-cache";
import { isPathInside } from "./path-containment";
import {
	resolveExistingTaskFile,
	resolveExistingTaskFolder,
	resolveTaskFileDestination,
	resolveTaskFolderDestination,
} from "./task-storage-path";

const KOWORKER_DIR = ".koworker";
const PRIMARY_FILE = "index.md";

function assertVaultEntryName(name: string) {
	if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
		throw new Error("Nome inválido no vault");
	}
}

async function resolveVaultRoot(projectRoute: string) {
	const projectRoot = await realpath(projectRoute).catch(() => null);
	if (!projectRoot) {
		throw new Error("Raiz do projeto não encontrada");
	}

	const vaultPath = join(projectRoot, KOWORKER_DIR);
	const stats = await lstat(vaultPath).catch(() => null);
	if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) {
		throw new Error("Diretório .koworker inválido");
	}

	const root = await realpath(vaultPath);
	if (!isPathInside(projectRoot, root)) {
		throw new Error("Diretório .koworker fora do projeto");
	}

	return root;
}

async function ensureVaultRoot(projectRoute: string) {
	await mkdir(join(projectRoute, KOWORKER_DIR), { recursive: true });

	return resolveVaultRoot(projectRoute);
}

async function resolveVaultFile(root: string, name: string) {
	assertVaultEntryName(name);

	const path = join(root, name);
	const stats = await lstat(path).catch(() => null);
	if (!stats || stats.isSymbolicLink() || !stats.isFile()) {
		throw new Error(`Arquivo "${name}" não encontrado no vault`);
	}

	const target = await realpath(path);
	if (!isPathInside(root, target)) {
		throw new Error(`Arquivo "${name}" fora do vault`);
	}

	return target;
}

async function resolveVaultFileDestination(root: string, name: string) {
	assertVaultEntryName(name);

	const path = join(root, name);
	const stats = await lstat(path).catch(() => null);
	if (stats?.isSymbolicLink()) {
		throw new Error(`Arquivo "${name}" aponta para link simbólico`);
	}

	return path;
}

// Pastas soltas do vault podem viver fora do alcance do watcher (não são pastas de task), então
// aqui o TTL é curto: a invalidação por evento cobre o comum e o TTL garante que nada obsoleto
// sobreviva além de poucos segundos.
const VAULT_TTL_MS = 5_000;

const vaultFilesCache = createFolderCache<VaultFileMeta[]>(VAULT_TTL_MS);
const vaultFoldersCache =
	createFolderCache<{ name: string; files: VaultFileMeta[] }[]>(VAULT_TTL_MS);
const vaultMdMetaCache = createFolderCache<VaultFileMeta[]>(VAULT_TTL_MS);

// Metadados por arquivo do vault: nome, título (H1) e mtime. Sem conteúdo — quem abre um
// arquivo carrega só ele via getVaultFile.
export type VaultFileMeta = {
	name: string;
	title: string;
	mtime: number;
};

// Lê só o começo do arquivo (suficiente pra achar o H1) para não carregar o .md inteiro só pelo
// título. 4 KB cobre H1 e preâmbulo com folga.
const TITLE_READ_BYTES = 4096;

// Título = primeiro H1 do markdown; fallback = nome do arquivo sem extensão.
function titleFromMarkdown(content: string, fallback: string): string {
	const h1 = content.match(/^#\s+(.+)$/m);
	return h1?.[1].trim() || fallback;
}

// Metadados de um único .md: mtime via stat e título lendo só os primeiros KB (não o arquivo
// inteiro). É o leitor compartilhado pelas três fontes do vault (soltos, pastas, tasks).
async function readMdMeta(path: string, name: string): Promise<VaultFileMeta> {
	const [stats, head] = await Promise.all([
		stat(path).catch(() => null),
		Bun.file(path)
			.slice(0, TITLE_READ_BYTES)
			.text()
			.catch(() => ""),
	]);
	return {
		name,
		title: titleFromMarkdown(head, name.replace(/\.md$/, "")),
		mtime: stats?.mtimeMs ?? 0,
	};
}

// Vault = `.md` soltos direto em `.koworker/`, fora de pasta de task. Pastas de task
// (e seus `.md`) ficam de fora porque só listamos arquivos no nível raiz. Metadata-only.
export async function listVaultFiles(projectRoute: string): Promise<VaultFileMeta[]> {
	const dir = await resolveVaultRoot(projectRoute).catch(() => null);
	if (!dir) return [];

	return vaultFilesCache.get(dir, () => loadVaultFiles(dir));
}

async function loadVaultFiles(dir: string): Promise<VaultFileMeta[]> {
	let names: string[];
	try {
		names = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);
	} catch {
		return [];
	}

	names.sort((a, b) => a.localeCompare(b));

	return Promise.all(names.map((name) => readMdMeta(join(dir, name), name)));
}

// Metadados (nome, título, mtime) dos `.md` de uma pasta qualquer relativa ao projeto — usado
// pelo vault pra montar as entries dos arquivos dentro das pastas das tasks, sem ler conteúdo.
export async function listMdMeta(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<VaultFileMeta[]> {
	const dir = await resolveExistingTaskFolder(params).catch(() => null);
	if (!dir) return [];

	return vaultMdMetaCache.get(dir, () => loadMdMeta(dir));
}

async function loadMdMeta(dir: string): Promise<VaultFileMeta[]> {
	const names = [...(await listMdNames(dir))].sort((a, b) => a.localeCompare(b));
	return Promise.all(names.map((name) => readMdMeta(join(dir, name), name)));
}

// Conteúdo de um único .md solto da raiz do vault, com seu título (H1). null quando o arquivo
// não existe — a rota de abertura trata isso como "nota não encontrada".
export async function getVaultFile(params: {
	projectRoute: string;
	name: string;
}): Promise<{ name: string; title: string; content: string } | null> {
	const root = await resolveVaultRoot(params.projectRoute).catch(() => null);
	if (!root) return null;

	const path = await resolveVaultFile(root, params.name).catch(() => null);
	if (!path) return null;

	const content = await Bun.file(path)
		.text()
		.catch(() => null);
	if (content === null) return null;

	return {
		name: params.name,
		title: titleFromMarkdown(content, params.name.replace(/\.md$/, "")),
		content,
	};
}

// Path de uma pasta solta relativo ao project.main_route, ex: ".koworker/notas-antigas".
// É o folder_path que a task adotada passa a apontar, sem mover nada.
export function vaultFolderPath(folderName: string): string {
	if (RESERVED_KOWORKER_FOLDERS.has(folderName)) {
		throw new Error("Pasta reservada pelo storage de tarefas");
	}

	return join(KOWORKER_DIR, folderName);
}

// Conteúdo (nome + texto) de todos os `.md` de uma pasta relativa ao projeto, com index.md
// primeiro. Base do "copiar conteúdo" de uma pasta — lê o conteúdo inteiro, ao contrário de
// listMdMeta. Serve tarefas (folder_path) e pastas soltas (vaultFolderPath) igual.
export async function readFolderMarkdown(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<{ name: string; content: string }[]> {
	const dir = await resolveExistingTaskFolder(params);
	const names = [...(await listMdNames(dir))].sort((a, b) => {
		if (a === PRIMARY_FILE) return -1;
		if (b === PRIMARY_FILE) return 1;
		return a.localeCompare(b);
	});

	return Promise.all(
		names.map(async (name) => ({
			name,
			content: await Bun.file(join(dir, name))
				.text()
				.catch(() => ""),
		})),
	);
}

// True se a pasta solta existe no disco — guarda da adoção contra nome que não corresponde a
// nenhuma pasta real.
export async function vaultFolderExists(params: {
	projectRoute: string;
	folderName: string;
}): Promise<boolean> {
	const root = await resolveVaultRoot(params.projectRoute).catch(() => null);
	if (!root) return false;

	try {
		assertVaultEntryName(params.folderName);
	} catch {
		return false;
	}

	const stats = await lstat(join(root, params.folderName)).catch(() => null);

	return !!stats && !stats.isSymbolicLink() && stats.isDirectory();
}

// Pastas soltas = subdiretórios de `.koworker/` que não pertencem a nenhuma task (os nomes em
// `knownFolderNames` são as pastas das tasks vivas). Cada uma traz os metadados dos seus `.md`
// (nome, título, mtime); pastas sem `.md` ficam de fora, como na seção "Em tarefas". Devolve
// ordenado por nome.
export async function listVaultFolders(params: {
	projectRoute: string;
	knownFolderNames: Set<string>;
}): Promise<{ name: string; files: VaultFileMeta[] }[]> {
	const dir = await resolveVaultRoot(params.projectRoute).catch(() => null);
	if (!dir) return [];

	const knownFolders = params.knownFolderNames;
	// A chave carrega o conjunto de pastas de task (elas mudam quando uma task nasce/some), pra não
	// servir uma pasta de task como "pasta solta". O prefixo da invalidação é `dir`, que casa aqui.
	const key = `${dir}::${[...knownFolders].sort().join("|")}`;
	return vaultFoldersCache.get(key, () => loadVaultFolders(dir, knownFolders));
}

async function loadVaultFolders(
	dir: string,
	knownFolderNames: Set<string>,
): Promise<{ name: string; files: VaultFileMeta[] }[]> {
	let dirNames: string[];
	try {
		dirNames = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && !knownFolderNames.has(entry.name))
			.map((entry) => entry.name);
	} catch {
		return [];
	}

	const folders = await Promise.all(
		dirNames.map(async (name) => {
			const folderDir = join(dir, name);
			const fileNames = [...(await listMdNames(folderDir))].sort((a, b) => a.localeCompare(b));
			const files = await Promise.all(
				fileNames.map((fileName) => readMdMeta(join(folderDir, fileName), fileName)),
			);
			return { name, files };
		}),
	);

	return folders
		.filter((folder) => folder.files.length > 0)
		.sort((a, b) => a.name.localeCompare(b.name));
}

// Renomeia um `.md` solto na raiz do vault. Diferente de vincular/soltar, aqui o nome é escolha
// do usuário, então colisão é erro — não inventamos sufixo.
export async function renameVaultFile(params: {
	projectRoute: string;
	oldName: string;
	newName: string;
}): Promise<void> {
	const dir = await resolveVaultRoot(params.projectRoute);
	const sourcePath = await resolveVaultFile(dir, params.oldName);
	const destPath = await resolveVaultFileDestination(dir, params.newName);

	const exists = await lstat(destPath)
		.then(() => true)
		.catch(() => false);
	if (exists) throw new Error(`Arquivo "${params.newName}" já existe no vault`);

	await rename(sourcePath, destPath);
	invalidateFolderPrefix(dir);
}

// Apaga um `.md` solto da raiz do vault. `force` evita estourar se a nota já não existir.
export async function deleteVaultFile(params: {
	projectRoute: string;
	name: string;
}): Promise<void> {
	const root = await resolveVaultRoot(params.projectRoute);
	const path = await resolveVaultFile(root, params.name).catch(() => null);
	if (!path) return;

	await rm(path, { force: true });
	invalidateFolderPrefix(root);
}

export async function writeVaultFile(params: {
	projectRoute: string;
	name: string;
	content: string;
}): Promise<void> {
	const dir = await ensureVaultRoot(params.projectRoute);
	await Bun.write(await resolveVaultFileDestination(dir, params.name), params.content);
	invalidateFolderPrefix(dir);
}

// Move um `.md` solto do vault para uma pasta de task nova como `index.md`. O arquivo
// some do vault (rename atômico dentro do mesmo `.koworker/`). Devolve o índice da task.
export async function promoteVaultFile(params: {
	projectRoute: string;
	name: string;
	folderPath: string;
}): Promise<void> {
	const dir = await resolveVaultRoot(params.projectRoute);
	const sourcePath = await resolveVaultFile(dir, params.name);
	const destPath = await resolveTaskFileDestination({
		projectRoute: params.projectRoute,
		folderPath: params.folderPath,
		name: PRIMARY_FILE,
	});

	await rename(sourcePath, destPath);

	invalidateFolderPrefix(dir);
	invalidateFolderPrefix(dirname(destPath));
}

// Move um ou mais `.md` soltos do vault para a pasta de uma tarefa (rename atômico dentro
// do mesmo `.koworker/`). Colisões (com os `.md` já na tarefa e dentro do próprio lote)
// resolvem com sufixo numérico — a UI só permite renomear quando há um único arquivo, então
// vincular vários `index.md` não pode travar. Devolve os nomes finais pra UI avisar do renome.
export async function linkVaultFilesToTask(params: {
	projectRoute: string;
	taskFolderPath: string;
	files: { name: string; targetName: string }[];
}): Promise<{ name: string; finalName: string }[]> {
	const root = await resolveVaultRoot(params.projectRoute);
	const taskDir = await resolveTaskFolderDestination({
		projectRoute: params.projectRoute,
		folderPath: params.taskFolderPath,
	});
	await mkdir(taskDir, { recursive: true });

	const taken = await listMdNames(taskDir);

	const results: { name: string; finalName: string }[] = [];
	for (const { name, targetName } of params.files) {
		const finalName = uniqueName(targetName, taken);
		taken.add(finalName);

		const sourcePath = await resolveVaultFile(root, name);
		const destPath = await resolveTaskFileDestination({
			projectRoute: params.projectRoute,
			folderPath: params.taskFolderPath,
			name: finalName,
		});

		await rename(sourcePath, destPath);
		results.push({ name: targetName, finalName });
	}

	invalidateFolderPrefix(root);
	invalidateFolderPrefix(taskDir);

	return results;
}

// Move arquivos já vinculados (de qualquer pasta de tarefa) para a pasta de outra tarefa.
// Confere todos os destinos — contra os arquivos já lá e contra colisões dentro do próprio
// lote — antes de mover qualquer um, pra não deixar metade movida se um nome bater.
export async function moveFilesToTask(params: {
	projectRoute: string;
	targetFolderPath: string;
	files: { sourceFolderPath: string; name: string }[];
}): Promise<void> {
	const targetDir = await resolveTaskFolderDestination({
		projectRoute: params.projectRoute,
		folderPath: params.targetFolderPath,
	});
	await mkdir(targetDir, { recursive: true });

	const taken = new Set<string>();
	for (const { name } of params.files) {
		assertVaultEntryName(name);

		const collides =
			taken.has(name) ||
			(await lstat(join(targetDir, name))
				.then(() => true)
				.catch(() => false));
		if (collides) throw new Error(`Arquivo "${name}" já existe na tarefa de destino`);
		taken.add(name);
	}

	for (const { sourceFolderPath, name } of params.files) {
		const sourcePath = await resolveExistingTaskFile({
			projectRoute: params.projectRoute,
			folderPath: sourceFolderPath,
			name,
		});
		const destPath = await resolveTaskFileDestination({
			projectRoute: params.projectRoute,
			folderPath: params.targetFolderPath,
			name,
		});

		await rename(sourcePath, destPath);
	}

	invalidateFolderPrefix(await resolveVaultRoot(params.projectRoute));
}

// Nomes dos `.md` direto numa pasta (não recursivo). Pasta inexistente vira conjunto vazio.
async function listMdNames(dir: string): Promise<Set<string>> {
	return new Set(
		(await readdir(dir, { withFileTypes: true }).catch(() => []))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name),
	);
}

// Acha um nome livre: se `name` já está tomado, tenta `base-2.md`, `base-3.md`...
function uniqueName(name: string, taken: Set<string>): string {
	if (!taken.has(name)) return name;

	const base = name.replace(/\.md$/, "");
	let i = 2;
	while (taken.has(`${base}-${i}.md`)) {
		i++;
	}
	return `${base}-${i}.md`;
}

// Solta arquivos vinculados de volta pra raiz do vault. Colisões (com a raiz e dentro do próprio
// lote — vários index.md de tarefas distintas) resolvem com sufixo numérico. Devolve os nomes
// finais pra UI poder avisar quando houve renome.
export async function unlinkFilesToVault(params: {
	projectRoute: string;
	files: { sourceFolderPath: string; name: string }[];
}): Promise<{ name: string; finalName: string }[]> {
	const rootDir = await ensureVaultRoot(params.projectRoute);

	const taken = await listMdNames(rootDir);

	const results: { name: string; finalName: string }[] = [];
	for (const { sourceFolderPath, name } of params.files) {
		const finalName = uniqueName(name, taken);
		taken.add(finalName);

		const sourcePath = await resolveExistingTaskFile({
			projectRoute: params.projectRoute,
			folderPath: sourceFolderPath,
			name,
		});

		await rename(sourcePath, await resolveVaultFileDestination(rootDir, finalName));
		results.push({ name, finalName });
	}

	invalidateFolderPrefix(rootDir);

	return results;
}
