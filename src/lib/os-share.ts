import { toast } from "sonner";

import { orpc } from "@/client";
import { copyToClipboard } from "@/lib/build-prompt";
import { isTauri } from "@/lib/tauri";

// Ações de "abrir no SO" e "compartilhar" de uma pasta (tarefa, skill, nota/pasta solta). Recebem
// sempre um diretório ABSOLUTO (o backend é dono de `main_route`/`folder_path`; o frontend só junta
// com o que já tem). No Tauri usam os comandos nativos (o zip ainda copia pro clipboard); no browser
// caem no backend, que roda na mesma máquina e faz o xdg-open/zip ele mesmo.

async function invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
	const { invoke } = await import("@tauri-apps/api/core");
	return invoke<T>(command, args);
}

// Junta a raiz absoluta do projeto (`mainRoute`) com um path relativo (`folder_path`, ".koworker"…).
// O backend é dono de cada metade; aqui só as combinamos pra alimentar os comandos do SO.
export function joinPath(base: string, rel: string): string {
	return `${base.replace(/\/+$/, "")}/${rel.replace(/^\/+/, "")}`;
}

// Abre o diretório no gerenciador de arquivos do SO. Recebe um diretório — passar um arquivo
// abriria ele no editor padrão, não a "localização".
export async function openFolderInOs(dir: string): Promise<void> {
	try {
		if (isTauri()) {
			await invoke("open_folder", { path: dir });
		} else {
			await orpc.system.openFolder.call({ path: dir });
		}
	} catch (error) {
		console.error("[os-share] abrir pasta:", error);
		toast.error("Não foi possível abrir a pasta");
	}
}

type ShareZipResult = { clipboard: boolean; zipPath: string };

// Compacta a pasta num `.zip`. No Tauri, copia o arquivo pro clipboard (e revela como fallback). No
// browser, o backend gera o zip e revelamos no gerenciador — copiar-arquivo-pro-clipboard é do
// desktop (Fatia 3 leva ao backend).
export async function shareFolderAsZip(dir: string): Promise<void> {
	try {
		if (isTauri()) {
			const result = await invoke<ShareZipResult>("share_folder_as_zip", { path: dir });

			if (result.clipboard) {
				toast.success("Zip copiado — cole no gerenciador de arquivos");
				return;
			}

			await openFolderInOs(result.zipPath.replace(/[/\\][^/\\]*$/, ""));
			toast.success("Zip criado — abrindo no gerenciador de arquivos");
			return;
		}

		const { zipPath } = await orpc.system.shareZip.call({ path: dir });
		await openFolderInOs(zipPath.replace(/[/\\][^/\\]*$/, ""));
		toast.success("Zip criado — abrindo no gerenciador de arquivos");
	} catch (error) {
		console.error("[os-share] zip:", error);
		toast.error("Não foi possível compactar a pasta");
	}
}

// Copia o markdown (conteúdo de um arquivo ou a concatenação de uma pasta) pro clipboard como texto.
export async function copyMarkdown(content: string): Promise<void> {
	if (!content.trim()) {
		toast.info("Nada para copiar");
		return;
	}

	const ok = await copyToClipboard(content);
	toast[ok ? "success" : "error"](ok ? "Conteúdo copiado" : "Falha ao copiar conteúdo");
}
