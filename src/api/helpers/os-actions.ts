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

export function expandTilde(raw: string): string {
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

// Compacta a pasta num `.zip` temporário e copia o arquivo pro clipboard (best-effort Linux). O zip
// inclui a própria pasta como raiz, então extrair recria a pasta inteira. `clipboard` false (não é
// Linux, ferramenta ausente ou falhou) sinaliza ao chamador que ele deve revelar o zip no gerenciador.
export async function shareZip(path: string): Promise<{ clipboard: boolean; zipPath: string }> {
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

	const clipboard = await copyFileToClipboard(zipPath);

	return { clipboard, zipPath };
}

// Percent-encoda o caminho pro file-URI (RFC 3986), preservando `/` e os unreserved. Sem isso, nome de
// pasta com espaço/acento gera URI não-conforme e o gerenciador não cola. Bytes multibyte (UTF-8)
// viram %XX por byte.
function encodeUriPath(path: string): string {
	// Unreserved da RFC 3986 mais `/`: mantidos verbatim; todo o resto vira %XX por byte UTF-8.
	const keep = /[A-Za-z0-9/\-_.~]/;
	let out = "";

	for (const byte of new TextEncoder().encode(path)) {
		const char = String.fromCodePoint(byte);
		out += keep.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
	}

	return out;
}

// Coloca o `.zip` no clipboard como arquivo (só Linux). O alvo MIME depende do DE: a família GNOME
// (Nautilus/Nemo/Caja) cola de `x-special/gnome-copied-files`; o resto (KDE, XFCE…) de `text/uri-list`.
// Usa `wl-copy` no Wayland e `xclip` no X11. Retorna false se a ferramenta não existir/falhar — o
// chamador então revela o zip no gerenciador.
async function copyFileToClipboard(zipPath: string): Promise<boolean> {
	if (process.platform !== "linux") {
		return false;
	}

	const uri = `file://${encodeUriPath(zipPath)}`;
	const desktop = (process.env.XDG_CURRENT_DESKTOP ?? "").toLowerCase();
	const gnomeFamily = ["gnome", "cinnamon", "mate", "unity"].some((name) => desktop.includes(name));

	const [mime, payload] = gnomeFamily
		? ["x-special/gnome-copied-files", `copy\n${uri}`]
		: ["text/uri-list", `${uri}\r\n`];

	const argv = process.env.WAYLAND_DISPLAY
		? ["wl-copy", "--type", mime]
		: ["xclip", "-selection", "clipboard", "-t", mime];

	try {
		const proc = Bun.spawn(argv, {
			stdin: new TextEncoder().encode(payload),
			stdout: "ignore",
			stderr: "ignore",
		});

		return (await proc.exited) === 0;
	} catch {
		return false;
	}
}

// Capacidades do host que a UI precisa conhecer, mas que só o backend sabe (ele roda na máquina do
// usuário). A primeira versão Windows sai sem terminal — decisão do plano de portabilidade: a UI de
// tarefas fica completa, a invocação por terminal chega depois. Nas demais plataformas o terminal é
// um serviço do backend e está sempre disponível.
export function systemCapabilities(): { canOpenTerminal: boolean } {
	return { canOpenTerminal: process.platform !== "win32" };
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
