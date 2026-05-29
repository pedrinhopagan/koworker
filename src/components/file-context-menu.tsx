import { Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

// Menu de botão direito de um arquivo `.md` (Renomear / Deletar), igual em qualquer tela: vault e
// abas da tarefa só passam o nome e os callbacks. ContextMenu abre só no contextmenu, então o
// clique esquerdo (selecionar / arrastar / abrir) do alvo segue intocado.
export function FileContextMenu({
	name,
	onRename,
	onDelete,
	children,
}: {
	name: string;
	onRename: () => void;
	onDelete: () => void;
	children: ReactNode;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-[200px] rounded-none">
				<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
					{name}
				</ContextMenuLabel>
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
