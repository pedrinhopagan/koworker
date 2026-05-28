import { ChevronsDownUp, ChevronsUpDown, ClipboardCopy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";

// Controles do editor markdown que aparecem igual no header de tarefa e de vault. Apenas
// dispara as ações no DocEditorPane; nenhum estado próprio.
export function DocToolbar({
	onCollapse,
	onExpand,
	onCopyContent,
	onCopyPath,
}: {
	onCollapse: () => void;
	onExpand: () => void;
	onCopyContent: () => void;
	onCopyPath: () => void;
}) {
	return (
		<div className="flex shrink-0 items-center gap-1">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onCollapse}
				title="Recolher todos os títulos"
				aria-label="Recolher todos os títulos"
				className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
			>
				<ChevronsDownUp className="h-3.5 w-3.5" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onExpand}
				title="Expandir todos os títulos"
				aria-label="Expandir todos os títulos"
				className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
			>
				<ChevronsUpDown className="h-3.5 w-3.5" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onCopyContent}
				title="Copiar conteúdo do arquivo"
				aria-label="Copiar conteúdo do arquivo"
				className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
			>
				<ClipboardCopy className="h-3.5 w-3.5" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onCopyPath}
				title="Copiar caminho do arquivo"
				aria-label="Copiar caminho do arquivo"
				className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
			>
				<Link2 className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}
