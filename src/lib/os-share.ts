import { toast } from "sonner";

import { orpc } from "@/client";
import { copyToClipboard } from "@/lib/build-prompt";

// Ações de "abrir no SO" e "compartilhar" de uma pasta (tarefa, skill, nota/pasta solta). Recebem
// sempre um diretório ABSOLUTO (o backend é dono de `main_route`/`folder_path`; o frontend só junta
// com o que já tem). Tudo passa pelo backend, que roda na mesma máquina do usuário e faz o
// xdg-open/zip/clipboard ele mesmo — funciona igual no browser e no desktop.

// Junta a raiz absoluta do projeto (`mainRoute`) com um path relativo (`folder_path`, ".koworker"…).
// O backend é dono de cada metade; aqui só as combinamos pra alimentar os comandos do SO.
export function joinPath(base: string, rel: string): string {
	return `${base.replace(/\/+$/, "")}/${rel.replace(/^\/+/, "")}`;
}

// Abre o diretório no gerenciador de arquivos do SO. Recebe um diretório — passar um arquivo
// abriria ele no editor padrão, não a "localização".
export async function openFolderInOs(dir: string): Promise<void> {
	try {
		await orpc.system.openFolder.call({ path: dir });
	} catch (error) {
		console.error("[os-share] abrir pasta:", error);
		toast.error("Não foi possível abrir a pasta");
	}
}

// Compacta a pasta num `.zip`. O backend copia o arquivo pro clipboard (best-effort Linux); quando
// consegue, é só colar no gerenciador. Senão, revelamos o zip no gerenciador de arquivos.
export async function shareFolderAsZip(dir: string): Promise<void> {
	try {
		const { clipboard, zipPath } = await orpc.system.shareZip.call({ path: dir });

		if (clipboard) {
			toast.success("Zip copiado — cole no gerenciador de arquivos");
			return;
		}

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
