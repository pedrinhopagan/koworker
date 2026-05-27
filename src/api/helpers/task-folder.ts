import { mkdir, readdir, rm } from "node:fs/promises";
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

// O título canônico da task vive na primeira linha H1 do index.md (`# Título`).
// Retorna null se não houver H1 — aí o título do banco não é tocado.
export function extractTitleFromMarkdown(content: string): string | null {
	const match = content.match(/^#\s+(.+?)\s*$/m);
	return match ? match[1].trim() : null;
}

// Pasta da task relativa ao project.main_route, ex: ".koworker/3f2a8b1c". S\u00F3 o id curto,
// sem slug do t\u00EDtulo \u2014 o t\u00EDtulo vive no banco e no H1 do index.md, n\u00E3o no nome da pasta.
export function buildFolderPath(id: string): string {
	return join(KOWORKER_DIR, id.slice(0, 8));
}

// Cria a pasta da task com um index.md inicial contendo o título como H1.
export async function createTaskFolder(params: {
	projectRoute: string;
	folderPath: string;
	title: string;
}): Promise<void> {
	await ensureKoworkerGitignored(params.projectRoute);

	const dir = join(params.projectRoute, params.folderPath);
	await mkdir(dir, { recursive: true });
	await Bun.write(join(dir, PRIMARY_FILE), `# ${params.title}\n`);
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

	entries.sort((a, b) => {
		if (a === PRIMARY_FILE) return -1;
		if (b === PRIMARY_FILE) return 1;
		return a.localeCompare(b);
	});

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

export async function removeTaskFolder(params: {
	projectRoute: string;
	folderPath: string;
}): Promise<void> {
	await rm(join(params.projectRoute, params.folderPath), { recursive: true, force: true });
}
