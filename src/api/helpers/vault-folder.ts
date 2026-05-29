import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildFolderPath } from "./task-folder";

const KOWORKER_DIR = ".koworker";
const PRIMARY_FILE = "index.md";

export type VaultFile = {
	name: string;
	title: string;
	content: string;
};

// Título = primeiro H1 do markdown; fallback = nome do arquivo sem extensão.
function titleFromMarkdown(content: string, fallback: string): string {
	const h1 = content.match(/^#\s+(.+)$/m);
	return h1?.[1].trim() || fallback;
}

// Vault = `.md` soltos direto em `.koworker/`, fora de pasta de task. Pastas de task
// (e seus `.md`) ficam de fora porque só listamos arquivos no nível raiz.
export async function listVaultFiles(projectRoute: string): Promise<VaultFile[]> {
	const dir = join(projectRoute, KOWORKER_DIR);

	let entries: string[];
	try {
		entries = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);
	} catch {
		return [];
	}

	entries.sort((a, b) => a.localeCompare(b));

	return Promise.all(
		entries.map(async (name) => {
			const content = await Bun.file(join(dir, name)).text();
			return { name, title: titleFromMarkdown(content, name.replace(/\.md$/, "")), content };
		}),
	);
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
