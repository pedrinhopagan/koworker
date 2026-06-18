import {
	FileArchive,
	FolderOpen,
	Pin,
	PinOff,
	SlidersHorizontal,
	SquareArrowOutUpRight,
} from "lucide-react";
import type { ReactNode } from "react";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

// Menu de botão direito de skill/agent (os dois são gêmeos: mesma forma, mesmas ações). Igual ao
// `FileContextMenu`, é um componente só, sem discriminar a entidade: o tile já computa rota, dir e
// chave de pin e os entrega como `actions`. ContextMenu abre só no contextmenu, então o clique
// esquerdo (navegar pela página de detalhe) do tile segue intocado.
export function DocEntityContextMenu({
	label,
	pinned,
	actions,
	children,
}: {
	label: string;
	pinned: boolean;
	actions: {
		onTogglePin: () => void;
		onOpen: () => void;
		onOpenInOs: () => void;
		onShareZip: () => void;
		onAppearance: () => void;
	};
	children: ReactNode;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-[220px] rounded-none">
				<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
					{label}
				</ContextMenuLabel>
				<ContextMenuItem onSelect={actions.onTogglePin} className="px-3 py-2">
					{pinned ? <PinOff className="mr-2 size-4" /> : <Pin className="mr-2 size-4" />}
					{pinned ? "Desfixar sessão" : "Fixar sessão"}
				</ContextMenuItem>
				<ContextMenuItem onSelect={actions.onOpen} className="px-3 py-2">
					<SquareArrowOutUpRight className="mr-2 size-4" />
					Abrir
				</ContextMenuItem>
				<ContextMenuItem onSelect={actions.onOpenInOs} className="px-3 py-2">
					<FolderOpen className="mr-2 size-4" />
					Abrir no sistema
				</ContextMenuItem>
				<ContextMenuItem onSelect={actions.onShareZip} className="px-3 py-2">
					<FileArchive className="mr-2 size-4" />
					Compartilhar zip
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={actions.onAppearance} className="px-3 py-2">
					<SlidersHorizontal className="mr-2 size-4" />
					Aparência
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
