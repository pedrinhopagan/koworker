import { BookOpen, ChevronsDownUp, ChevronsUpDown, ClipboardCopy, Link2 } from "lucide-react";

import { DocSheetActionButton } from "@/components/doc-mobile-actions-drawer";
import { DocShareControls, type DocShareHandlers } from "@/components/doc-share-controls";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

// Controles do editor markdown que aparecem igual no header de tarefa e de vault. Apenas
// dispara as ações no DocEditorPane; nenhum estado próprio. `share`, quando presente, anexa o botão
// "Abrir no sistema" e o menu "Compartilhar" (a página resolve os caminhos).
export function DocToolbar({
	onCollapse,
	onExpand,
	onCopyContent,
	onCopyPath,
	onReading,
	share,
	layout = "inline",
	onAction,
}: {
	onCollapse: () => void;
	onExpand: () => void;
	onCopyContent?: () => void;
	onCopyPath: () => void;
	onReading: () => void;
	share?: DocShareHandlers;
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
					icon={<BookOpen className="size-[18px]" />}
					label="Modo leitura"
					onClick={() => runAction(onReading)}
				/>
				<DocSheetActionButton
					icon={<ChevronsDownUp className="size-[18px]" />}
					label="Recolher todos os títulos"
					onClick={() => runAction(onCollapse)}
				/>
				<DocSheetActionButton
					icon={<ChevronsUpDown className="size-[18px]" />}
					label="Expandir todos os títulos"
					onClick={() => runAction(onExpand)}
				/>
				{onCopyContent && (
					<DocSheetActionButton
						icon={<ClipboardCopy className="size-[18px]" />}
						label="Copiar conteúdo do arquivo"
						onClick={() => runAction(onCopyContent)}
					/>
				)}
				<DocSheetActionButton
					icon={<Link2 className="size-[18px]" />}
					label="Copiar caminho do arquivo"
					onClick={() => runAction(onCopyPath)}
				/>
				{share ? <DocShareControls {...share} layout="stacked" onAction={onAction} /> : null}
			</>
		);
	}

	return (
		<div className="flex shrink-0 items-center gap-1">
			<Tooltip label="Modo leitura">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onReading}
					aria-label="Modo leitura"
					className="size-12 p-0 md:size-6 text-muted-foreground hover:text-foreground"
				>
					<BookOpen className="size-4 md:size-3.5" />
				</Button>
			</Tooltip>
			<Tooltip label="Recolher todos os títulos">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onCollapse}
					aria-label="Recolher todos os títulos"
					className="size-12 p-0 md:size-6 text-muted-foreground hover:text-foreground"
				>
					<ChevronsDownUp className="size-4 md:size-3.5" />
				</Button>
			</Tooltip>
			<Tooltip label="Expandir todos os títulos">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onExpand}
					aria-label="Expandir todos os títulos"
					className="size-12 p-0 md:size-6 text-muted-foreground hover:text-foreground"
				>
					<ChevronsUpDown className="size-4 md:size-3.5" />
				</Button>
			</Tooltip>
			{onCopyContent && (
				<Tooltip label="Copiar conteúdo do arquivo">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={onCopyContent}
						aria-label="Copiar conteúdo do arquivo"
						className="size-12 p-0 md:size-6 text-muted-foreground hover:text-foreground"
					>
						<ClipboardCopy className="size-4 md:size-3.5" />
					</Button>
				</Tooltip>
			)}
			<Tooltip label="Copiar caminho do arquivo">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onCopyPath}
					aria-label="Copiar caminho do arquivo"
					className="size-12 p-0 md:size-6 text-muted-foreground hover:text-foreground"
				>
					<Link2 className="size-4 md:size-3.5" />
				</Button>
			</Tooltip>
			{share ? <DocShareControls {...share} /> : null}
		</div>
	);
}
