import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildFolderPath } from "./task-folder";

const KOWORKER_DIR = ".koworker";
const PRIMARY_FILE = "index.md";

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
	const dir = join(projectRoute, KOWORKER_DIR);

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
	const dir = join(params.projectRoute, params.folderPath);
	const names = [...(await listMdNames(dir))].sort((a, b) => a.localeCompare(b));
	return Promise.all(names.map((name) => readMdMeta(join(dir, name), name)));
}

// Conteúdo de um único .md solto da raiz do vault, com seu título (H1). null quando o arquivo
// não existe — a rota de abertura trata isso como "nota não encontrada".
export async function getVaultFile(params: {
	projectRoute: string;
	name: string;
}): Promise<{ name: string; title: string; content: string } | null> {
	const path = join(params.projectRoute, KOWORKER_DIR, params.name);

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
	return join(KOWORKER_DIR, folderName);
}

// True se a pasta solta existe no disco — guarda da adoção contra nome que não corresponde a
// nenhuma pasta real.
export function vaultFolderExists(params: {
	projectRoute: string;
	folderName: string;
}): Promise<boolean> {
	return stat(join(params.projectRoute, KOWORKER_DIR, params.folderName))
		.then((s) => s.isDirectory())
		.catch(() => false);
}

// Pastas soltas = subdiretórios de `.koworker/` que não pertencem a nenhuma task (os nomes em
// `knownFolderNames` são as pastas das tasks vivas). Cada uma traz os metadados dos seus `.md`
// (nome, título, mtime); pastas sem `.md` ficam de fora, como na seção "Em tarefas". Devolve
// ordenado por nome.
export async function listVaultFolders(params: {
	projectRoute: string;
	knownFolderNames: Set<string>;
}): Promise<{ name: string; files: VaultFileMeta[] }[]> {
	const dir = join(params.projectRoute, KOWORKER_DIR);

	let dirNames: string[];
	try {
		dirNames = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && !params.knownFolderNames.has(entry.name))
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
	const dir = join(params.projectRoute, KOWORKER_DIR);
	const destPath = join(dir, params.newName);

	const exists = await stat(destPath)
		.then(() => true)
		.catch(() => false);
	if (exists) throw new Error(`Arquivo "${params.newName}" já existe no vault`);

	await rename(join(dir, params.oldName), destPath);
}

// Apaga um `.md` solto da raiz do vault. `force` evita estourar se a nota já não existir.
export async function deleteVaultFile(params: {
	projectRoute: string;
	name: string;
}): Promise<void> {
	await rm(join(params.projectRoute, KOWORKER_DIR, params.name), { force: true });
}

export async function writeVaultFile(params: {
	projectRoute: string;
	name: string;
	content: string;
}): Promise<void> {
	const dir = join(params.projectRoute, KOWORKER_DIR);
	await mkdir(dir, { recursive: true });
	await Bun.write(join(dir, params.name), params.content);
}

// Move um `.md` solto do vault para uma pasta de task nova como `index.md`. O arquivo
// some do vault (rename atômico dentro do mesmo `.koworker/`). Devolve o índice da task.
export async function promoteVaultFile(params: {
	projectRoute: string;
	name: string;
	taskId: string;
}): Promise<{ folderPath: string; title: string }> {
	const dir = join(params.projectRoute, KOWORKER_DIR);
	const sourcePath = join(dir, params.name);

	const content = await Bun.file(sourcePath).text();
	const title = titleFromMarkdown(content, params.name.replace(/\.md$/, ""));
	const folderPath = buildFolderPath(params.taskId);

	await mkdir(join(params.projectRoute, folderPath), { recursive: true });
	await rename(sourcePath, join(params.projectRoute, folderPath, PRIMARY_FILE));

	return { folderPath, title };
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
	const taskDir = join(params.projectRoute, params.taskFolderPath);
	await mkdir(taskDir, { recursive: true });

	const taken = await listMdNames(taskDir);

	const results: { name: string; finalName: string }[] = [];
	for (const { name, targetName } of params.files) {
		const finalName = uniqueName(targetName, taken);
		taken.add(finalName);
		await rename(join(params.projectRoute, KOWORKER_DIR, name), join(taskDir, finalName));
		results.push({ name: targetName, finalName });
	}

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
	const targetDir = join(params.projectRoute, params.targetFolderPath);
	await mkdir(targetDir, { recursive: true });

	const taken = new Set<string>();
	for (const { name } of params.files) {
		const collides =
			taken.has(name) ||
			(await stat(join(targetDir, name))
				.then(() => true)
				.catch(() => false));
		if (collides) throw new Error(`Arquivo "${name}" já existe na tarefa de destino`);
		taken.add(name);
	}

	for (const { sourceFolderPath, name } of params.files) {
		await rename(join(params.projectRoute, sourceFolderPath, name), join(targetDir, name));
	}
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
	const rootDir = join(params.projectRoute, KOWORKER_DIR);
	await mkdir(rootDir, { recursive: true });

	const taken = await listMdNames(rootDir);

	const results: { name: string; finalName: string }[] = [];
	for (const { sourceFolderPath, name } of params.files) {
		const finalName = uniqueName(name, taken);
		taken.add(finalName);
		await rename(join(params.projectRoute, sourceFolderPath, name), join(rootDir, finalName));
		results.push({ name, finalName });
	}

	return results;
}
