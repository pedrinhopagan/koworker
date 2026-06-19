import {
	Check,
	FileArchive,
	FolderOpen,
	Pin,
	PinOff,
	SlidersHorizontal,
	SquareArrowOutUpRight,
	Tag,
} from "lucide-react";
import type { ReactNode } from "react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SkillCategory } from "@/types/skills";
import { useSkillSettingsMutation } from "../-utils/use-skill-settings";

// Menu único da skill (card e detalhe): aparência e categoria são coisas separadas. "Aparência" abre
// o dialog; "Categoria" abre um submenu à direita que move a skill direto, sem dialog. No card ele
// recebe `docActions` (fixar/abrir/zip) e roda controlado, pra abrir tanto pelo botão (clique
// esquerdo) quanto pelo clique direito no card; no detalhe vem sem isso e cai no modo descontrolado.
export function SkillSettingsMenu({
	skill,
	categories,
	onAppearance,
	trigger,
	open,
	onOpenChange,
	docActions,
}: {
	skill: { slug: string; categoryId: string | null };
	categories: SkillCategory[];
	onAppearance: () => void;
	trigger: ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	docActions?: {
		pinned: boolean;
		onTogglePin: () => void;
		onOpen: () => void;
		onOpenInOs: () => void;
		onShareZip: () => void;
	};
}) {
	const settingsMutation = useSkillSettingsMutation();

	function moveTo(categoryId: string | null) {
		if (categoryId === skill.categoryId) return;
		settingsMutation.mutate({ slug: skill.slug, categoryId });
	}

	return (
		// modal={false}: o menu pode abrir pelo clique direito (fonte que não é o trigger) sobre o grid
		// rolável — sem o lock modal de pointer-events no body, some o risco de a página travar após
		// fechar e o salto de scrollbar ao abrir.
		<DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
			<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuItem onSelect={onAppearance}>
					<SlidersHorizontal />
					Aparência
				</DropdownMenuItem>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Tag />
						Categoria
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="max-h-72 w-52 overflow-y-auto">
						<CategoryItem
							name="Sem categoria"
							color="#6b7280"
							active={skill.categoryId === null}
							onSelect={() => moveTo(null)}
						/>
						{categories.map((category) => (
							<CategoryItem
								key={category.id}
								name={category.name}
								color={category.color}
								active={skill.categoryId === category.id}
								onSelect={() => moveTo(category.id)}
							/>
						))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				{docActions && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={docActions.onTogglePin}>
							{docActions.pinned ? <PinOff /> : <Pin />}
							{docActions.pinned ? "Desfixar sessão" : "Fixar sessão"}
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={docActions.onOpen}>
							<SquareArrowOutUpRight />
							Abrir
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={docActions.onOpenInOs}>
							<FolderOpen />
							Abrir no sistema
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={docActions.onShareZip}>
							<FileArchive />
							Compartilhar zip
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function CategoryItem({
	name,
	color,
	active,
	onSelect,
}: {
	name: string;
	color: string;
	active: boolean;
	onSelect: () => void;
}) {
	return (
		<DropdownMenuItem onSelect={onSelect}>
			<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
			<span className="min-w-0 flex-1 truncate">{name}</span>
			{active && <Check />}
		</DropdownMenuItem>
	);
}
