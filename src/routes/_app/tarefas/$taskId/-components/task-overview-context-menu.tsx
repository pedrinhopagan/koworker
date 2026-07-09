import { ClipboardCopy, FileArchive, FolderOpen, Link as LinkIcon, Share2 } from "lucide-react";
import type { ReactNode } from "react";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function TaskOverviewContextMenu({
	label,
	actions,
	children,
}: {
	label: string;
	actions: {
		onCopyPath: () => void;
		onOpenInOs: () => void;
		onCopyContent: () => void;
		onCopyZip: () => void;
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
				<ContextMenuItem onSelect={actions.onCopyPath} className="px-3 py-2">
					<LinkIcon className="mr-2 size-4" />
					Copiar caminho da tarefa
				</ContextMenuItem>
				<ContextMenuItem onSelect={actions.onOpenInOs} className="px-3 py-2">
					<FolderOpen className="mr-2 size-4" />
					Abrir no sistema
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuSub>
					<ContextMenuSubTrigger className="px-3 py-2">
						<Share2 className="mr-2 size-4" />
						Compartilhar
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className="w-[200px]">
						<ContextMenuItem onSelect={actions.onCopyContent} className="px-3 py-2">
							<ClipboardCopy className="mr-2 size-4" />
							Copiar conteúdo
						</ContextMenuItem>
						<ContextMenuItem onSelect={actions.onCopyZip} className="px-3 py-2">
							<FileArchive className="mr-2 size-4" />
							Copiar zip
						</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
			</ContextMenuContent>
		</ContextMenu>
	);
}
