import {
	BookOpen,
	ChevronsDownUp,
	ChevronsUpDown,
	Cpu,
	EllipsisVertical,
	FileArchive,
	FolderOpen,
	Link2,
	Pin,
	PinOff,
	Settings2,
	SlidersHorizontal,
	Trash2,
} from "lucide-react";

import { InvokeDefaultsControl } from "@/components/invoke-defaults-control";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useState } from "react";
import { SkillMetadataFields } from "./skill-metadata-controls";

type Metadata = Record<string, unknown>;

// Menu único de ações secundárias do cabeçalho da skill: um dropdown compacto reúne aparência, doc
// actions, abrir/zip e excluir. "Metadados" e "Padrões de invocação" são editores (campos e selects),
// então cada um abre um popover ancorado no gatilho em vez de aninhar controles interativos dentro do
// próprio dropdown (o que quebraria o dismiss do Radix). Nada aqui se repete inline no cabeçalho.
export function SkillHeaderActions({
	metadata,
	pinned,
	onMetadataChange,
	onAppearance,
	onTogglePin,
	onReading,
	onCollapse,
	onExpand,
	onCopyPath,
	onOpenInOs,
	onShareZip,
	onDelete,
}: {
	metadata: Metadata;
	pinned: boolean;
	onMetadataChange: (next: Metadata) => void;
	onAppearance: () => void;
	onTogglePin: () => void;
	onReading: () => void;
	onCollapse: () => void;
	onExpand: () => void;
	onCopyPath: () => void;
	onOpenInOs: () => void;
	onShareZip: () => void;
	onDelete: () => void;
}) {
	const [metaOpen, setMetaOpen] = useState(false);
	const [invokeOpen, setInvokeOpen] = useState(false);

	return (
		<div className="relative shrink-0">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="sm"
						title="Mais ações"
						aria-label="Mais ações"
					>
						<EllipsisVertical className="size-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem onSelect={onAppearance}>
						<SlidersHorizontal />
						Aparência
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setMetaOpen(true)}>
						<Settings2 />
						Metadados
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setInvokeOpen(true)}>
						<Cpu />
						Padrões de invocação
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={onTogglePin}>
						{pinned ? <PinOff /> : <Pin />}
						{pinned ? "Desfixar sessão" : "Fixar sessão"}
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onCopyPath}>
						<Link2 />
						Copiar caminho
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onReading}>
						<BookOpen />
						Modo leitura
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onCollapse}>
						<ChevronsDownUp />
						Recolher títulos
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onExpand}>
						<ChevronsUpDown />
						Expandir títulos
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onOpenInOs}>
						<FolderOpen />
						Abrir no sistema
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onShareZip}>
						<FileArchive />
						Compartilhar zip
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onSelect={onDelete}
						className="text-destructive data-[highlighted]:text-destructive"
					>
						<Trash2 />
						Excluir skill
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Popover open={metaOpen} onOpenChange={setMetaOpen}>
				<PopoverAnchor className="pointer-events-none absolute right-0 bottom-0 h-0 w-0" />
				<PopoverContent
					align="end"
					collisionPadding={{ right: 16 }}
					className="max-h-[70vh] w-80 overflow-y-auto p-4"
				>
					<SkillMetadataFields metadata={metadata} onChange={onMetadataChange} />
				</PopoverContent>
			</Popover>

			<Popover open={invokeOpen} onOpenChange={setInvokeOpen}>
				<PopoverAnchor className="pointer-events-none absolute right-0 bottom-0 h-0 w-0" />
				<PopoverContent align="end" collisionPadding={{ right: 16 }} className="w-auto p-3">
					<div className="flex flex-col gap-2">
						<Text size="xs" tone="muted" className="font-medium uppercase tracking-wide">
							Padrões de invocação
						</Text>
						<InvokeDefaultsControl metadata={metadata} onChange={onMetadataChange} />
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
