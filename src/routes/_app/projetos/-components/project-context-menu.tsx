import { useNavigate } from "@tanstack/react-router";
import { FolderOpen, Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { openFolderInOs } from "@/lib/os-share";
import { useDeleteProject } from "../-utils/use-delete-project";

// Menu de botão direito de um card de projeto: abrir a pasta no SO, editar (rota de detalhe) e
// excluir (com confirmação). O menu é dono da exclusão — quem mexe no dado confirma e dispara —, e o
// ConfirmDialog fica fora do ContextMenu pra não viver no portal do menu.
export function ProjectContextMenu({
	project,
	children,
}: {
	project: { id: string; name: string; mainRoute: string };
	children: ReactNode;
}) {
	const navigate = useNavigate();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const { deleteProject, loading } = useDeleteProject({ projectId: project.id });

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
				<ContextMenuContent className="w-[220px] rounded-none">
					<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
						{project.name}
					</ContextMenuLabel>
					<ContextMenuItem
						onSelect={() => void openFolderInOs(project.mainRoute)}
						className="px-3 py-2"
					>
						<FolderOpen className="mr-2 size-4" />
						Abrir pasta no sistema
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={() =>
							navigate({ to: "/projetos/$projetoId", params: { projetoId: project.id } })
						}
						className="px-3 py-2"
					>
						<Pencil className="mr-2 size-4" />
						Editar
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						onSelect={() => setConfirmDelete(true)}
						className="px-3 py-2 text-destructive focus:text-destructive"
					>
						<Trash2 className="mr-2 size-4" />
						Excluir
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<ConfirmDialog
				open={confirmDelete}
				onClose={() => setConfirmDelete(false)}
				onConfirm={() => {
					deleteProject();
					setConfirmDelete(false);
				}}
				title={`Excluir o projeto "${project.name}"?`}
				description="O projeto sai da lista. Os arquivos na pasta não são apagados. Esta ação não pode ser desfeita."
				confirmLabel="Excluir"
				variant="danger"
				loading={loading}
			/>
		</>
	);
}
