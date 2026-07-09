import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import { copyMarkdown, joinPath, openFolderInOs, shareFolderAsZip } from "@/lib/os-share";

// Ações de compartilhamento da pasta da tarefa (abrir no SO, copiar conteúdo concatenado, copiar
// zip). Resolve o caminho absoluto do projeto + folder_path; `folderAbs` é null quando a tarefa
// ainda não carregou ou não tem projeto (órfã) e aí o menu de compartilhar não aparece. Puro: não salva o editor pendente — o
// `$file` embrulha `copyContent`/`copyZip` com `paneRef.flush()` no caller.
export function useTaskShare(
	task: {
		id: string;
		folderPath: string;
		project: { id: string; mainRoute: string } | null;
	} | null,
) {
	const queryClient = useQueryClient();
	const folderAbs = task?.project ? joinPath(task.project.mainRoute, task.folderPath) : null;

	// Copiar conteúdo = todos os .md da tarefa concatenados. A concatenação canônica vive no backend;
	// busca fresco (staleTime 0) pra refletir a última edição.
	const copyContent = async () => {
		if (!task?.project) {
			return;
		}
		try {
			const result = await queryClient.fetchQuery({
				...orpc.vault.exportContent.queryOptions({
					input: { projectId: task.project.id, target: { kind: "task", taskId: task.id } },
				}),
				staleTime: 0,
			});
			await copyMarkdown(result.content);
		} catch {
			toast.error("Não foi possível exportar o conteúdo");
		}
	};

	const copyZip = async () => {
		if (!folderAbs) {
			return;
		}
		await shareFolderAsZip(folderAbs);
	};

	const openInOs = () => {
		if (!folderAbs) {
			return;
		}
		openFolderInOs(folderAbs);
	};

	return { folderAbs, copyContent, copyZip, openInOs };
}
