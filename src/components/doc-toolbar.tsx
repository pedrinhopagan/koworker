import { BookOpen, ChevronsDownUp, ChevronsUpDown, ClipboardCopy, Link2, Pin } from "lucide-react";

import { DocShareControls, type DocShareHandlers } from "@/components/doc-share-controls";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Controles do editor markdown que aparecem igual no header de tarefa e de vault. Apenas
// dispara as ações no DocEditorPane; nenhum estado próprio. O par `pinned`/`onTogglePin` é opcional:
// quando presente, mostra o botão de fixar a sessão de leitura no switcher (Alt+`). `share`, quando
// presente, anexa o botão "Abrir no sistema" e o menu "Compartilhar" (a página resolve os caminhos).
export function DocToolbar({
	onCollapse,
	onExpand,
	onCopyContent,
	onCopyPath,
	onReading,
	pinned,
	onTogglePin,
	share,
}: {
	onCollapse: () => void;
	onExpand: () => void;
	onCopyContent: () => void;
	onCopyPath: () => void;
	onReading: () => void;
	pinned?: boolean;
	onTogglePin?: () => void;
	share?: DocShareHandlers;
}) {
	return (
		<div className="flex shrink-0 items-center gap-1">
			{onTogglePin ? (
				<Tooltip label={pinned ? "Desafixar sessão de leitura" : "Fixar sessão de leitura (Alt+`)"}>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={onTogglePin}
						aria-label={pinned ? "Desafixar sessão de leitura" : "Fixar sessão de leitura"}
						aria-pressed={pinned}
						className={cn(
							"h-6 w-6 min-h-6 min-w-6 p-0",
							pinned
								? "text-[var(--project-accent,var(--primary))]"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Pin className={cn("h-3.5 w-3.5", pinned && "fill-current")} />
					</Button>
				</Tooltip>
			) : null}
			<Tooltip label="Modo leitura">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onReading}
					aria-label="Modo leitura"
					className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
				>
					<BookOpen className="h-3.5 w-3.5" />
				</Button>
			</Tooltip>
			<Tooltip label="Recolher todos os títulos">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onCollapse}
					aria-label="Recolher todos os títulos"
					className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
				>
					<ChevronsDownUp className="h-3.5 w-3.5" />
				</Button>
			</Tooltip>
			<Tooltip label="Expandir todos os títulos">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onExpand}
					aria-label="Expandir todos os títulos"
					className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
				>
					<ChevronsUpDown className="h-3.5 w-3.5" />
				</Button>
			</Tooltip>
			<Tooltip label="Copiar conteúdo do arquivo">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onCopyContent}
					aria-label="Copiar conteúdo do arquivo"
					className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
				>
					<ClipboardCopy className="h-3.5 w-3.5" />
				</Button>
			</Tooltip>
			<Tooltip label="Copiar caminho do arquivo">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onCopyPath}
					aria-label="Copiar caminho do arquivo"
					className="h-6 w-6 min-h-6 min-w-6 p-0 text-muted-foreground hover:text-foreground"
				>
					<Link2 className="h-3.5 w-3.5" />
				</Button>
			</Tooltip>
			{share ? <DocShareControls {...share} /> : null}
		</div>
	);
}
