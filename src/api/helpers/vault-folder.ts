import { mkdir, readdir, rename } from "node:fs/promises";
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
