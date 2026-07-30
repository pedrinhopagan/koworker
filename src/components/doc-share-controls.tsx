import { ClipboardCopy, FileArchive, FolderOpen, Share2 } from "lucide-react";

import { DocSheetActionButton } from "@/components/doc-mobile-actions-drawer";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";

// Abrir a pasta no SO + menu "Compartilhar". Só dispara os callbacks do dono — nenhum estado nem
// resolução de caminho aqui. Conteúdo e zip são opcionais e o menu só aparece com ao menos um: uma
// nota solta (arquivo único, copiar conteúdo já é o botão da toolbar) fica só com "Abrir no sistema".
export type DocShareHandlers = {
	onOpenInOs: () => void;
	onCopyContent?: () => void;
	onCopyZip?: () => void;
};

export function DocShareControls({
	onOpenInOs,
	onCopyContent,
	onCopyZip,
	layout = "inline",
	onAction,
}: DocShareHandlers & {
	layout?: "inline" | "stacked";
	onAction?: () => void;
}) {
	function runAction(fn: () => void) {
		fn();
		onAction?.();
	}

	if (layout === "stacked") {
		return (
			<>
				<DocSheetActionButton
					icon={<FolderOpen className="size-[18px]" />}
					label="Abrir no sistema"
					onClick={() => runAction(onOpenInOs)}
				/>
				{onCopyContent ? (
					<DocSheetActionButton
						icon={<ClipboardCopy className="size-[18px]" />}
						label="Copiar conteúdo"
						onClick={() => runAction(onCopyContent)}
					/>
				) : null}
				{onCopyZip ? (
					<DocSheetActionButton
						icon={<FileArchive className="size-[18px]" />}
						label="Copiar zip"
						onClick={() => runAction(onCopyZip)}
					/>
				) : null}
			</>
		);
	}

	return (
		<div className="flex shrink-0 items-center gap-1">
			<Tooltip label="Abrir no sistema">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onOpenInOs}
					aria-label="Abrir no sistema"
					className="size-12 p-0 md:size-6 text-muted-foreground hover:text-foreground"
				>
					<FolderOpen className="size-4 md:size-3.5" />
				</Button>
			</Tooltip>
			{onCopyContent || onCopyZip ? (
				<DropdownMenu>
					<Tooltip label="Compartilhar">
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Compartilhar"
								className="size-12 p-0 md:size-6 text-muted-foreground hover:text-foreground"
							>
								<Share2 className="size-4 md:size-3.5" />
							</Button>
						</DropdownMenuTrigger>
					</Tooltip>
					<DropdownMenuContent align="end" className="w-48">
						{onCopyContent ? (
							<DropdownMenuItem onSelect={onCopyContent} className="gap-2">
								<ClipboardCopy className="size-4" />
								Copiar conteúdo
							</DropdownMenuItem>
						) : null}
						{onCopyZip ? (
							<DropdownMenuItem onSelect={onCopyZip} className="gap-2">
								<FileArchive className="size-4" />
								Copiar zip
							</DropdownMenuItem>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}
