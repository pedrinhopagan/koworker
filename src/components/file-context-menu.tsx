import { FolderOpen, Link as LinkIcon, Pencil, Route as RouteIcon, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyToClipboard } from "@/lib/build-prompt";

// Menu de botão direito de um arquivo `.md` (Copiar caminho / Renomear / Deletar), igual em qualquer
// tela: vault e abas da tarefa só passam o nome e os callbacks. `path` é opcional — quando presente,
// habilita "Copiar caminho" (relativo à raiz do projeto). ContextMenu abre só no contextmenu, então o
// clique esquerdo (selecionar / arrastar / abrir) do alvo segue intocado. O `stopPropagation` no
// trigger impede que o contextmenu suba pra menus externos (o global da tarefa / AppContextMenu):
// clicar num card sempre abre o menu do próprio arquivo.
export function FileContextMenu({
	name,
	path,
	route,
	onRename,
	onDelete,
	onOpenFolder,
	children,
}: {
	name: string;
	path?: string;
	route?: string;
	onRename: () => void;
	onDelete: () => void;
	onOpenFolder?: () => void;
	children: ReactNode;
}) {
	async function handleCopyPath() {
		if (!path) return;
		const ok = await copyToClipboard(path);
		toast[ok ? "success" : "error"](ok ? "Caminho copiado" : "Falha ao copiar caminho");
	}

	async function handleCopyRoute() {
		if (!route) return;
		const ok = await copyToClipboard(route);
		toast[ok ? "success" : "error"](ok ? "Rota copiada" : "Falha ao copiar rota");
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div className="contents" onContextMenu={(e) => e.stopPropagation()}>
					{children}
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-[200px] rounded-none">
				<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
					{name}
				</ContextMenuLabel>
				{path ? (
					<ContextMenuItem
						onSelect={() => void handleCopyPath()}
						className="rounded-none px-3 py-2 text-muted-foreground focus:text-foreground"
					>
						<LinkIcon className="mr-2 size-4" />
						Copiar caminho
					</ContextMenuItem>
				) : null}
				{route ? (
					<ContextMenuItem
						onSelect={() => void handleCopyRoute()}
						className="rounded-none px-3 py-2 text-muted-foreground focus:text-foreground"
					>
						<RouteIcon className="mr-2 size-4" />
						Copiar rota
					</ContextMenuItem>
				) : null}
				{onOpenFolder ? (
					<ContextMenuItem
						onSelect={onOpenFolder}
						className="rounded-none px-3 py-2 text-muted-foreground focus:text-foreground"
					>
						<FolderOpen className="mr-2 size-4" />
						Abrir na pasta
					</ContextMenuItem>
				) : null}
				<ContextMenuSeparator />
				<ContextMenuItem
					onSelect={onRename}
					className="rounded-none px-3 py-2 text-muted-foreground focus:text-foreground"
				>
					<Pencil className="mr-2 size-4" />
					Renomear
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem
					onSelect={onDelete}
					className="rounded-none px-3 py-2 text-destructive focus:text-destructive"
				>
					<Trash2 className="mr-2 size-4" />
					Deletar
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
