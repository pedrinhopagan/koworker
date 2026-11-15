import {
	BookOpen,
	ChevronsDownUp,
	ChevronsUpDown,
	EllipsisVertical,
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
	onDelete,
}: {
	onAppearance: () => void;
	onReading: () => void;
	onCollapse: () => void;
	onExpand: () => void;
	onDelete: () => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					title="Mais ações"
					aria-label="Mais ações"
					className="shrink-0 text-muted-foreground hover:text-foreground"
				>
					<EllipsisVertical className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
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
				<DropdownMenuItem onSelect={onAppearance}>
					<SlidersHorizontal />
					Aparência
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
	);
}
