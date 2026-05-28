import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

// Garante que `.koworker/` está no `.gitignore` do projeto. O conteúdo das tasks é
// canônico no FS mas nunca deve ir pro git. Idempotente: só faz append se faltar.
async function ensureKoworkerGitignored(projectRoute: string): Promise<void> {
	const gitignorePath = join(projectRoute, ".gitignore");
	const file = Bun.file(gitignorePath);

	const current = (await file.exists()) ? await file.text() : "";
	const alreadyIgnored = current
		.split("\n")
		.some((line) => line.trim().replace(/\/$/, "") === ".koworker");
	if (alreadyIgnored) return;

	const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
	await Bun.write(gitignorePath, `${current}${prefix}.koworker/\n`);
}

export type TaskFile = {
	name: string;
	content: string;
};

const KOWORKER_DIR = ".koworker";
export const PRIMARY_FILE = "index.md";

const DISPLAY_TITLE_FALLBACK = "Sem título";
const DISPLAY_TITLE_MAX_LENGTH = 80;

// Ordena os .md da pasta: index.md primeiro, o resto alfabético.
function compareMarkdownNames(a: string, b: string): number {
	if (a === PRIMARY_FILE) return -1;
	if (b === PRIMARY_FILE) return 1;
	return a.localeCompare(b);
}

// Primeira linha não-vazia do conteúdo, com markup de heading removido e truncada.
function firstMeaningfulLine(content: string): string | null {
	for (const line of content.split("\n")) {
		const stripped = line.replace(/^#{1,6}\s+/, "").trim();
		if (stripped) return stripped.slice(0, DISPLAY_TITLE_MAX_LENGTH);
	}
	return null;
}

// O nome exibido da task: o título do banco quando há, senão o começo do primeiro .md,
// senão um placeholder. É a única fonte do que a UI renderiza como nome da task.
export function resolveDisplayTitle(params: { title?: string; firstContent?: string }): string {
	const title = params.title?.trim();
	if (title) return title;

	const fromContent = params.firstContent ? firstMeaningfulLine(params.firstContent) : null;
	return fromContent ?? DISPLAY_TITLE_FALLBACK;
}

// Pasta da task relativa ao project.main_route, ex: ".koworker/3f2a8b1c". S\u00F3 o id curto,
// sem slug do t\u00EDtulo \u2014 o t\u00EDtulo vive no banco, n\u00E3o no nome da pasta nem no H1 do index.md.
export function buildFolderPath(id: string): string {
	return join(KOWORKER_DIR, id.slice(0, 8));
}

// Cria a pasta da task com o index.md semeado pelo título (H1), pra que o prompt copiado
// referencie um arquivo com conteúdo já na criação. Sem título, o arquivo nasce vazio e a
// UI mostra o placeholder de escrita.
export async function createTaskFolder(params: {
	projectRoute: string;
	folderPath: string;
	title?: string;
}): Promise<void> {
	await ensureKoworkerGitignored(params.projectRoute);

	const dir = join(params.projectRoute, params.folderPath);
	await mkdir(dir, { recursive: true });
	await Bun.write(join(dir, PRIMARY_FILE), params.title ? `# ${params.title}\n` : "");
}

// Lista só os nomes dos .md da pasta, na ordem canônica (index.md primeiro, depois alfabético).
// Usado pela listagem de tasks pra mostrar quantos arquivos a task tem sem ler o conteúdo.
export async function listTaskMarkdownNames(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<string[]> {
	const dir = join(params.projectRoute, params.folderPath);

	try {
		const entries = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);
		entries.sort(compareMarkdownNames);
		return entries;
	} catch {
		return [];
	}
}

// Conteúdo do primeiro .md da pasta (mesma ordem de readTaskFiles), para o fallback de
// exibição das tasks sem título. Lê só um arquivo, não a pasta inteira.
export async function readFirstMarkdownContent(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<string | undefined> {
	const dir = join(params.projectRoute, params.folderPath);

	let entries: string[];
	try {
		entries = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);
	} catch {
		return undefined;
	}

	const first = entries.sort(compareMarkdownNames).at(0);
	if (!first) return undefined;

	return Bun.file(join(dir, first)).text();
}

// Lê todos os .md da pasta. index.md vem primeiro; o resto em ordem alfabética.
export async function readTaskFiles(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<{ files: TaskFile[]; primaryFile: string | null }> {
	const dir = join(params.projectRoute, params.folderPath);

	let entries: string[];
	try {
		entries = (await readdir(dir, { withFileTypes: true }))
			.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
			.map((entry) => entry.name);
	} catch {
		return { files: [], primaryFile: null };
	}

	entries.sort(compareMarkdownNames);

	const files = await Promise.all(
		entries.map(async (name) => ({ name, content: await Bun.file(join(dir, name)).text() })),
	);

	const primaryFile =
		files.find((file) => file.name === PRIMARY_FILE)?.name ?? files[0]?.name ?? null;
	return { files, primaryFile };
}

export async function writeTaskFile(params: {
	projectRoute: string;
	folderPath: string;
	name: string;
	content: string;
}): Promise<void> {
	const dir = join(params.projectRoute, params.folderPath);
	await mkdir(dir, { recursive: true });
	await Bun.write(join(dir, params.name), params.content);
}

export async function renameTaskFile(params: {
	projectRoute: string;
	folderPath: string;
	oldName: string;
	newName: string;
}): Promise<void> {
	const dir = join(params.projectRoute, params.folderPath);
	const destPath = join(dir, params.newName);

	const exists = await stat(destPath)
		.then(() => true)
		.catch(() => false);
	if (exists) throw new Error(`Arquivo "${params.newName}" já existe nesta tarefa`);

	await rename(join(dir, params.oldName), destPath);
}

export async function removeTaskFolder(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<void> {
	await rm(join(params.projectRoute, params.folderPath), { recursive: true, force: true });
}
