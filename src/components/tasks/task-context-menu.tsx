import {
	Check,
	CircleCheck,
	CircleDot,
	ClipboardCopy,
	EyeOff,
	FileArchive,
	FolderOpen,
	FolderSymlink,
	Layers,
	Link as LinkIcon,
	Pencil,
	Share2,
	SquareArrowOutUpRight,
	Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";

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

export type TaskMenuData = {
	projects: ProjectOption[];
	features?: ColorOption[];
};

// Só os campos que o menu lê. TaskFolder (vault) e Task (lista) mapeiam aqui.
export type TaskMenuTarget = {
	id: string;
	label: string;
	done: boolean;
	folderPath?: string;
	groupId?: string | null;
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
	onToggleDone: (target: TaskMenuTarget) => void;
	onIgnoreRecency?: (target: TaskMenuTarget) => void;
	onMoveToProject: (target: TaskMenuTarget, projectId: string) => void;
	onMoveToFeature?: (target: TaskMenuTarget, groupId: string | null) => void;
	onDelete: (target: TaskMenuTarget) => void;
};

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
			<ContextMenuItem onSelect={() => actions.onToggleDone(target)} className="px-3 py-2">
				{target.done ? (
					<CircleDot className="mr-2 size-4" />
				) : (
					<CircleCheck className="mr-2 size-4" />
				)}
				{target.done ? "Reabrir tarefa" : "Marcar como concluída"}
			</ContextMenuItem>
			{actions.onIgnoreRecency && (
				<ContextMenuItem onSelect={() => actions.onIgnoreRecency?.(target)} className="px-3 py-2">
					<EyeOff className="mr-2 size-4" />
					Ignorar nas recentes
				</ContextMenuItem>
			)}
			{data.features && actions.onMoveToFeature && (
				<ContextMenuSub>
					<ContextMenuSubTrigger className="px-3 py-2">
						<Layers className="mr-2 size-4" />
						Mover para feature
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className="max-h-72 w-[220px] overflow-y-auto">
						<ContextMenuItem
							onSelect={() => actions.onMoveToFeature?.(target, null)}
							className={cn("gap-2 px-3 py-2", !target.groupId && "font-medium")}
						>
							<span className="size-2 shrink-0 rounded-full bg-muted-foreground" />
							<span className="min-w-0 flex-1 truncate">Sem feature</span>
							{!target.groupId && <Check className="size-4 shrink-0 text-muted-foreground" />}
						</ContextMenuItem>
						{data.features.map((feature) => {
							const active = feature.id === target.groupId;

							return (
								<ContextMenuItem
									key={feature.id}
									onSelect={() => actions.onMoveToFeature?.(target, feature.id)}
									className={cn("gap-2 px-3 py-2", active && "font-medium")}
								>
									<span
										className="size-2 shrink-0 rounded-full"
										style={{ backgroundColor: feature.color }}
									/>
									<span className="min-w-0 flex-1 truncate">{feature.name}</span>
									{active && <Check className="size-4 shrink-0 text-muted-foreground" />}
								</ContextMenuItem>
							);
						})}
					</ContextMenuSubContent>
				</ContextMenuSub>
			)}
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
			<DeleteItem onDelete={() => actions.onDelete(target)} />
		</>
	);
}

function DeleteItem({ onDelete }: { onDelete: () => void }) {
	const [confirming, setConfirming] = useState(false);

	return (
		<ContextMenuItem
			onSelect={(event) => {
				if (!confirming) {
					event.preventDefault();
					setConfirming(true);
					return;
				}

				onDelete();
			}}
			className={cn(
				"px-3 py-2 text-destructive focus:text-destructive",
				confirming && "bg-destructive/10 font-medium",
			)}
		>
			{confirming ? <Check className="mr-2 size-4" /> : <Trash2 className="mr-2 size-4" />}
			{confirming ? "Confirmar exclusão" : "Excluir tarefa"}
		</ContextMenuItem>
	);
}

// Menu de contexto completo de uma tarefa: clique direito nos `children`. Usado fora do vault
// (ex.: lista de /tarefas). No vault os mesmos itens entram no Content da árvore via taskMenuItems.
export function TaskContextMenu({
	target,
	content,
	children,
}: {
	target: TaskMenuTarget;
	content: ReactNode;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);

	return (
		<ContextMenu onOpenChange={setOpen}>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			{open && (
				<ContextMenuContent className="w-[220px]">
					<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
						{target.label}
					</ContextMenuLabel>
					{content}
				</ContextMenuContent>
			)}
		</ContextMenu>
	);
}
