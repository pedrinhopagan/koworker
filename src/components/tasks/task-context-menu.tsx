import {
	Check,
	CircleCheck,
	CircleDot,
	ClipboardCopy,
	FileArchive,
	Flame,
	FolderOpen,
	FolderSymlink,
	LayoutGrid,
	Link as LinkIcon,
	Pencil,
	Share2,
	SquareArrowOutUpRight,
	Trash2,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

type ColorOption = { id: string; name: string; color: string };
type ProjectOption = { id: string; name: string; color: string };

// Listas dos submenus do menu de tarefa: projetos (já filtrados pelo caller, sem o da tarefa),
// prioridades e categorias.
export type TaskMenuData = {
	projects: ProjectOption[];
	priorities: ColorOption[];
	categories: ColorOption[];
};

// Só os campos que o menu lê. TaskFolder (vault) e TaskWithMeta (lista) mapeiam aqui.
export type TaskMenuTarget = {
	id: string;
	label: string;
	done: boolean;
	folderPath?: string;
	priorityId?: string | null;
	categoryId?: string | null;
};

// Actions presentational: o caller liga cada uma na mutation/navegação certa. Recebem o target
// pra resolver id/projeto sem o menu carregar contexto.
export type TaskMenuActions = {
	onCopyPath?: (target: TaskMenuTarget) => void;
	onOpen: (target: TaskMenuTarget) => void;
	onShareContent: (target: TaskMenuTarget) => void;
	onShareZip: (target: TaskMenuTarget) => void;
	onOpenInOs: (target: TaskMenuTarget) => void;
	onRename: (target: TaskMenuTarget) => void;
	onSetPriority: (target: TaskMenuTarget, priorityId: string) => void;
	onSetCategory: (target: TaskMenuTarget, categoryId: string) => void;
	onToggleDone: (target: TaskMenuTarget) => void;
	onMoveToProject: (target: TaskMenuTarget, projectId: string) => void;
	onDelete: (target: TaskMenuTarget) => void;
};

// Submenu de seleção colorida (prioridade/categoria): marca o item ativo e despacha o id.
function PickSub({
	label,
	icon: Icon,
	items,
	activeId,
	emptyLabel,
	onPick,
}: {
	label: string;
	icon: typeof Flame;
	items: ColorOption[];
	activeId?: string | null;
	emptyLabel: string;
	onPick: (id: string) => void;
}) {
	return (
		<ContextMenuSub>
			<ContextMenuSubTrigger className="px-3 py-2">
				<Icon className="mr-2 size-4" />
				{label}
			</ContextMenuSubTrigger>
			<ContextMenuSubContent className="max-h-72 w-[220px] overflow-y-auto">
				{items.length === 0 ? (
					<ContextMenuItem disabled className="px-3 py-2">
						{emptyLabel}
					</ContextMenuItem>
				) : (
					items.map((item) => {
						const active = item.id === activeId;
						return (
							<ContextMenuItem
								key={item.id}
								onSelect={() => onPick(item.id)}
								className={cn("gap-2 px-3 py-2", active && "font-medium")}
							>
								<span
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: item.color }}
								/>
								<span className="min-w-0 flex-1 truncate">{item.name}</span>
								{active && <Check className="size-4 shrink-0 text-muted-foreground" />}
							</ContextMenuItem>
						);
					})
				)}
			</ContextMenuSubContent>
		</ContextMenuSub>
	);
}

// Itens do menu de uma tarefa: copiar caminho, abrir, compartilhar, renomear, prioridade/categoria,
// concluir, migrar de projeto e excluir. Puro — o wrapper (ou o vault) decide onde renderiza.
export function taskMenuItems(
	target: TaskMenuTarget,
	data: TaskMenuData,
	actions: TaskMenuActions,
): ReactNode {
	return (
		<>
			{target.folderPath && actions.onCopyPath ? (
				<ContextMenuItem onSelect={() => actions.onCopyPath?.(target)} className="px-3 py-2">
					<LinkIcon className="mr-2 size-4" />
					Copiar caminho para a tarefa
				</ContextMenuItem>
			) : null}
			<ContextMenuItem onSelect={() => actions.onOpen(target)} className="px-3 py-2">
				<SquareArrowOutUpRight className="mr-2 size-4" />
				Abrir tarefa
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => actions.onOpenInOs(target)} className="px-3 py-2">
				<FolderOpen className="mr-2 size-4" />
				Abrir no sistema
			</ContextMenuItem>
			<ContextMenuSub>
				<ContextMenuSubTrigger className="px-3 py-2">
					<Share2 className="mr-2 size-4" />
					Compartilhar
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="w-[200px]">
					<ContextMenuItem onSelect={() => actions.onShareContent(target)} className="px-3 py-2">
						<ClipboardCopy className="mr-2 size-4" />
						Copiar conteúdo
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => actions.onShareZip(target)} className="px-3 py-2">
						<FileArchive className="mr-2 size-4" />
						Copiar zip
					</ContextMenuItem>
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => actions.onRename(target)} className="px-3 py-2">
				<Pencil className="mr-2 size-4" />
				Renomear
			</ContextMenuItem>
			<PickSub
				label="Prioridade"
				icon={Flame}
				items={data.priorities}
				activeId={target.priorityId}
				emptyLabel="Nenhuma prioridade"
				onPick={(id) => actions.onSetPriority(target, id)}
			/>
			<PickSub
				label="Categoria"
				icon={LayoutGrid}
				items={data.categories}
				activeId={target.categoryId}
				emptyLabel="Nenhuma categoria"
				onPick={(id) => actions.onSetCategory(target, id)}
			/>
			<ContextMenuItem onSelect={() => actions.onToggleDone(target)} className="px-3 py-2">
				{target.done ? (
					<CircleDot className="mr-2 size-4" />
				) : (
					<CircleCheck className="mr-2 size-4" />
				)}
				{target.done ? "Reabrir tarefa" : "Marcar como concluída"}
			</ContextMenuItem>
			<ContextMenuSub>
				<ContextMenuSubTrigger className="px-3 py-2">
					<FolderSymlink className="mr-2 size-4" />
					Mover para projeto
				</ContextMenuSubTrigger>
				<ContextMenuSubContent className="max-h-72 w-[220px] overflow-y-auto">
					{data.projects.length === 0 ? (
						<ContextMenuItem disabled className="px-3 py-2">
							Nenhum outro projeto
						</ContextMenuItem>
					) : (
						data.projects.map((project) => (
							<ContextMenuItem
								key={project.id}
								onSelect={() => actions.onMoveToProject(target, project.id)}
								className="gap-2 px-3 py-2"
							>
								<span
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: project.color }}
								/>
								<span className="min-w-0 flex-1 truncate">{project.name}</span>
							</ContextMenuItem>
						))
					)}
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSeparator />
			<ContextMenuItem
				onSelect={() => actions.onDelete(target)}
				className="px-3 py-2 text-destructive focus:text-destructive"
			>
				<Trash2 className="mr-2 size-4" />
				Excluir tarefa
			</ContextMenuItem>
		</>
	);
}

// Menu de contexto completo de uma tarefa: clique direito nos `children`. Usado fora do vault
// (ex.: lista de /tarefas). No vault os mesmos itens entram no Content da árvore via taskMenuItems.
export function TaskContextMenu({
	target,
	data,
	actions,
	children,
}: {
	target: TaskMenuTarget;
	data: TaskMenuData;
	actions: TaskMenuActions;
	children: ReactNode;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-[220px] rounded-none">
				<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
					{target.label}
				</ContextMenuLabel>
				{taskMenuItems(target, data, actions)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
