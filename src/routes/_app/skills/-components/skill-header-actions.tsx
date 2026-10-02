import {
	BookOpen,
	ChevronsDownUp,
	ChevronsUpDown,
	EllipsisVertical,
	FileArchive,
	FolderOpen,
	Link2,
	SlidersHorizontal,
	Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SkillHeaderActions({
	onAppearance,
	onReading,
	onCollapse,
	onExpand,
	onCopyPath,
	onOpenInOs,
	onShareZip,
	onDelete,
}: {
	onAppearance: () => void;
	onReading: () => void;
	onCollapse: () => void;
	onExpand: () => void;
	onCopyPath: () => void;
	onOpenInOs: () => void;
	onShareZip: () => void;
	onDelete: () => void;
}) {
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
		</div>
	);
}
