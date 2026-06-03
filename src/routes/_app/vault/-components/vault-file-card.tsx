import { FileText } from "lucide-react";

import { FileContextMenu } from "@/components/file-context-menu";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

// Entry plana do vault, como devolvida por vault.listEntries. content fica de fora — abrir um
// arquivo carrega só ele via vault.getFile.
export type VaultEntry = {
	name: string;
	title: string;
	mtime: number;
	origin: "loose" | "folder" | "task";
	groupKey: string | null;
};

// Chave de identidade de uma entry na lista plana: origem + groupKey + nome. O mesmo nome
// (ex: index.md) se repete entre tasks/pastas, então o nome sozinho não basta como key de render.
export function entryKey(entry: VaultEntry): string {
	return `${entry.origin}:${entry.groupKey ?? ""}:${entry.name}`;
}

// Card de um arquivo `.md`. Compartilhado pela visão agrupada (corpo de cada grupo) e pela lista
// plana. No modo organizar, `onSelect` substitui `onOpen`: o clique seleciona pra lote em vez de
// abrir (e arquivos de pasta solta, só leitura fora do modo, ficam selecionáveis). Notas soltas
// ganham o menu de contexto (renomear/deletar); arquivos de tarefa abrem na rota da aba.
export function VaultFileCard({
	entry,
	index,
	selected,
	onOpen,
	onSelect,
	onRenameLoose,
	onDeleteLoose,
}: {
	entry: VaultEntry;
	index: number;
	selected?: boolean;
	onOpen?: (entry: VaultEntry) => void;
	onSelect?: (entry: VaultEntry) => void;
	onRenameLoose?: (name: string) => void;
	onDeleteLoose?: (name: string) => void;
}) {
	const interactive = Boolean(onSelect ?? onOpen);

	const card = (
		<button
			type="button"
			disabled={!interactive}
			aria-pressed={onSelect ? Boolean(selected) : undefined}
			onClick={() => (onSelect ? onSelect(entry) : onOpen?.(entry))}
			className={cn(
				"group flex w-full flex-col gap-2 border bg-card p-4 text-left transition-colors",
				interactive ? "hover:bg-secondary/60" : "cursor-default",
				selected ? "border-primary ring-1 ring-primary" : "border-border",
				"animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			)}
			style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
		>
			<div className="flex items-center gap-2">
				<FileText className="size-4 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">
					{entry.title}
				</span>
			</div>
			<span className="truncate font-mono text-[11px] text-muted-foreground">
				editado {relativeTimeFrom(entry.mtime)}
			</span>
		</button>
	);

	if (entry.origin !== "loose" || !onRenameLoose || !onDeleteLoose) {
		return card;
	}

	return (
		<FileContextMenu
			name={entry.name}
			onRename={() => onRenameLoose(entry.name)}
			onDelete={() => onDeleteLoose(entry.name)}
		>
			{card}
		</FileContextMenu>
	);
}
