import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";

import { getSystemSettings } from "./system-settings";
import { zipDirectory } from "./zip";

const HOME = homedir();

// O comando que abre uma pasta no gerenciador de arquivos do SO — o mesmo que o Rust fazia por
// #[cfg], agora no backend para funcionar também no browser (o backend roda na máquina do usuário).
function fileManagerOpener(): string {
	switch (process.platform) {
		case "darwin":
			return "open";
		case "win32":
			return "explorer";
		default:
			return "xdg-open";
	}
}

function expandTilde(raw: string): string {
	if (raw === "~") {
		return HOME;
	}
	if (raw.startsWith("~/")) {
		return join(HOME, raw.slice(2));
	}
	return raw;
}

// Resolve o texto digitado para um caminho absoluto. Vazio → pasta base; relativo → dentro da base;
// `~` expande o home; absoluto passa direto.
function resolveInput(raw: string, base: string): string {
	if (raw === "") {
		return base;
	}
	const expanded = expandTilde(raw);
	return isAbsolute(expanded) ? expanded : join(base, expanded);
}

export function openInFileManager(path: string): void {
	const target = expandTilde(path);
	Bun.spawn([fileManagerOpener(), target], { stdout: "ignore", stderr: "ignore" });
}

// Compacta a pasta num `.zip` temporário e devolve o caminho. Sem clipboard-de-arquivo (isso é
// best-effort só do desktop): o chamador revela o zip no gerenciador. O zip inclui a própria pasta
// como raiz, então extrair recria a pasta inteira.
export async function shareZip(path: string): Promise<{ zipPath: string }> {
	const src = expandTilde(path);
	const info = await stat(src).catch(() => null);
	if (!info?.isDirectory()) {
		throw new Error(`Pasta não encontrada: ${src}`);
	}

	const bytes = await zipDirectory(src);
	const outDir = join(tmpdir(), "koworker-share");
	await mkdir(outDir, { recursive: true });

	const zipPath = join(outDir, `${basename(src) || "compartilhar"}.zip`);
	await rm(zipPath, { force: true });
	await writeFile(zipPath, bytes);

	return { zipPath };
}

export type DirectorySuggestion = { name: string; path: string };

async function listChildDirs(dir: string, filter: string): Promise<DirectorySuggestion[]> {
	const dirents = await readdir(dir, { withFileTypes: true }).catch(() => []);
	const lowered = filter.toLowerCase();

	return dirents
		.filter((dirent) => dirent.isDirectory() && dirent.name.toLowerCase().startsWith(lowered))
		.map((dirent) => ({ name: dirent.name, path: join(dir, dirent.name) }))
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, 50);
}

// Alimenta o campo de pasta no browser: valida se o caminho digitado é uma pasta existente e sugere
// os subdiretórios para autocomplete. Enquanto o texto termina numa pasta válida, lista os filhos
// dela; caso contrário, lista os irmãos que começam pelo trecho digitado.
export async function browseDirectory(
	rawInput: string,
): Promise<{ resolved: string; valid: boolean; suggestions: DirectorySuggestion[] }> {
	const base = (await getSystemSettings()).projectsBasePath;
	const raw = rawInput.trim();
	const resolved = resolveInput(raw, base);
	const info = await stat(resolved).catch(() => null);
	const valid = info?.isDirectory() ?? false;

	const listChildren = valid && (raw === "" || raw.endsWith("/"));
	const suggestions = listChildren
		? await listChildDirs(resolved, "")
		: await listChildDirs(dirname(resolved), basename(resolved));

	return { resolved, valid, suggestions };
}
