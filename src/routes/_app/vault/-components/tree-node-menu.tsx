import {
	ClipboardCopy,
	FileArchive,
	FolderInput,
	FolderOpen,
	FolderPlus,
	Pencil,
	Share2,
	Trash2,
	Unlink,
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
import {
	type TaskMenuActions,
	type TaskMenuData,
	type TaskMenuTarget,
	taskMenuItems,
} from "@/components/tasks/task-context-menu";
import type { TaskFolder, TreeNode } from "../-utils/build-vault-tree";

export type { TaskMenuData };

type TaskOption = { id: string; displayTitle: string };

// Callbacks node-shaped: o dono (index) despacha pra mutation certa pelo kind/origin. O picker de
// tarefa é um só (`onPickTask`) — link/move/moveFolder caem no mesmo gesto.
export type TreeActions = {
	onRename: (node: TreeNode) => void;
	onDelete: (node: TreeNode) => void;
	onPromote: (node: TreeNode) => void;
	onAdopt: (node: TreeNode) => void;
	onUnlink: (node: TreeNode) => void;
	onPickTask: (node: TreeNode, taskId: string) => void;
	// Compartilhar/abrir no SO. O dono resolve o diretório absoluto e o conteúdo pelo kind do nó.
	// onShareContent/onShareZip só são chamados em pastas (tarefa/skill/pasta solta); arquivo só abre.
	onOpenInOs: (node: TreeNode) => void;
	onShareContent: (node: TreeNode) => void;
	onShareZip: (node: TreeNode) => void;
	// Ações da pasta de tarefa (kind === "taskFolder"). O dono despacha pra mutation pelo taskId.
	onOpenTask: (node: TaskFolder) => void;
	onRenameTask: (node: TaskFolder) => void;
	onSetTaskPriority: (node: TaskFolder, priorityId: string) => void;
	onSetTaskCategory: (node: TaskFolder, categoryId: string) => void;
	onToggleTaskDone: (node: TaskFolder) => void;
	onMoveTaskToProject: (node: TaskFolder, projectId: string) => void;
	onDeleteTask: (node: TaskFolder) => void;
};

// "Abrir no sistema" + submenu "Compartilhar". Pasta (tarefa/skill/pasta solta) ganha o submenu
// com copiar conteúdo/zip; arquivo único só abre o local (não é pasta pra compactar/concatenar).
function ShareItems({
	node,
	actions,
	folder,
}: {
	node: TreeNode;
	actions: TreeActions;
	folder: boolean;
}) {
	return (
		<>
			<ContextMenuItem onSelect={() => actions.onOpenInOs(node)} className="px-3 py-2">
				<FolderOpen className="mr-2 size-4" />
				Abrir no sistema
			</ContextMenuItem>
			{folder ? (
				<ContextMenuSub>
					<ContextMenuSubTrigger className="px-3 py-2">
						<Share2 className="mr-2 size-4" />
						Compartilhar
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className="w-[200px]">
						<ContextMenuItem onSelect={() => actions.onShareContent(node)} className="px-3 py-2">
							<ClipboardCopy className="mr-2 size-4" />
							Copiar conteúdo
						</ContextMenuItem>
						<ContextMenuItem onSelect={() => actions.onShareZip(node)} className="px-3 py-2">
							<FileArchive className="mr-2 size-4" />
							Copiar zip
						</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
			) : null}
		</>
	);
}

// Adapta a pasta de tarefa do vault pro menu de tarefa compartilhado: nó → target e os callbacks
// node-shaped do vault → as actions target-shaped do menu. O Compartilhar/Abrir no sistema do nó
// resolve o dir pelo kind, então aqui só repassa o nó.
function taskFolderItems(node: TaskFolder, data: TaskMenuData, actions: TreeActions): ReactNode {
	const target: TaskMenuTarget = {
		id: node.taskId,
		label: node.label,
		done: node.done,
		priorityId: node.priorityId,
		categoryId: node.categoryId,
	};
	const taskActions: TaskMenuActions = {
		onOpen: () => actions.onOpenTask(node),
		onShareContent: () => actions.onShareContent(node),
		onShareZip: () => actions.onShareZip(node),
		onOpenInOs: () => actions.onOpenInOs(node),
		onRename: () => actions.onRenameTask(node),
		onSetPriority: (_t, id) => actions.onSetTaskPriority(node, id),
		onSetCategory: (_t, id) => actions.onSetTaskCategory(node, id),
		onToggleDone: () => actions.onToggleTaskDone(node),
		onMoveToProject: (_t, projectId) => actions.onMoveTaskToProject(node, projectId),
		onDelete: () => actions.onDeleteTask(node),
	};
	return taskMenuItems(target, data, taskActions);
}

function TaskPickerSub({
	label,
	tasks,
	onPick,
}: {
	label: string;
	tasks: TaskOption[];
	onPick: (taskId: string) => void;
}) {
	return (
		<ContextMenuSub>
			<ContextMenuSubTrigger className="px-3 py-2">
				<FolderInput className="mr-2 size-4" />
				{label}
			</ContextMenuSubTrigger>
			<ContextMenuSubContent className="max-h-72 w-[220px] overflow-y-auto">
				{tasks.length === 0 ? (
					<ContextMenuItem disabled className="px-3 py-2">
						Nenhuma tarefa
					</ContextMenuItem>
				) : (
					tasks.map((task) => (
						<ContextMenuItem
							key={task.id}
							onSelect={() => onPick(task.id)}
							className="truncate px-3 py-2"
						>
							{task.displayTitle}
						</ContextMenuItem>
					))
				)}
			</ContextMenuSubContent>
		</ContextMenuSub>
	);
}

// Itens do menu por kind/origin. null = nó sem ações (feature) → renderiza só a linha.
function menuItems(
	node: TreeNode,
	tasks: TaskOption[],
	taskMenuData: TaskMenuData,
	actions: TreeActions,
): ReactNode {
	if (node.kind === "taskFolder") {
		return taskFolderItems(node, taskMenuData, actions);
	}

	if (node.kind === "agentFolder" || node.kind === "skillFolder") {
		return <ShareItems node={node} actions={actions} folder />;
	}

	if (node.kind === "looseFolder") {
		return (
			<>
				<ShareItems node={node} actions={actions} folder />
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => actions.onAdopt(node)} className="px-3 py-2">
					<FolderPlus className="mr-2 size-4" />
					Transformar em tarefa
				</ContextMenuItem>
				<TaskPickerSub
					label="Mover arquivos para tarefa"
					tasks={tasks}
					onPick={(taskId) => actions.onPickTask(node, taskId)}
				/>
			</>
		);
	}

	if (node.kind !== "fileLeaf") {
		return null;
	}

	if (node.entry.origin === "loose") {
		return (
			<>
				<ShareItems node={node} actions={actions} folder={false} />
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => actions.onRename(node)} className="px-3 py-2">
					<Pencil className="mr-2 size-4" />
					Renomear
				</ContextMenuItem>
				<TaskPickerSub
					label="Vincular a tarefa"
					tasks={tasks}
					onPick={(taskId) => actions.onPickTask(node, taskId)}
				/>
				<ContextMenuItem onSelect={() => actions.onPromote(node)} className="px-3 py-2">
					<FolderPlus className="mr-2 size-4" />
					Transformar em tarefa
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem
					onSelect={() => actions.onDelete(node)}
					className="px-3 py-2 text-destructive focus:text-destructive"
				>
					<Trash2 className="mr-2 size-4" />
					Deletar
				</ContextMenuItem>
			</>
		);
	}

	if (node.entry.origin === "task") {
		return (
			<>
				<ShareItems node={node} actions={actions} folder={false} />
				<ContextMenuSeparator />
				<TaskPickerSub
					label="Mover para outra tarefa"
					tasks={tasks.filter((task) => task.id !== node.entry.groupKey)}
					onPick={(taskId) => actions.onPickTask(node, taskId)}
				/>
				<ContextMenuItem onSelect={() => actions.onUnlink(node)} className="px-3 py-2">
					<Unlink className="mr-2 size-4" />
					Soltar no vault
				</ContextMenuItem>
			</>
		);
	}

	// origin === "folder"
	return (
		<>
			<ShareItems node={node} actions={actions} folder={false} />
			<ContextMenuSeparator />
			<TaskPickerSub
				label="Mover para tarefa"
				tasks={tasks}
				onPick={(taskId) => actions.onPickTask(node, taskId)}
			/>
		</>
	);
}

export function TreeNodeMenu({
	node,
	tasks,
	taskMenuData,
	actions,
	onOpenChange,
	children,
}: {
	node: TreeNode;
	tasks: TaskOption[];
	taskMenuData: TaskMenuData;
	actions: TreeActions;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}) {
	const items = menuItems(node, tasks, taskMenuData, actions);
	if (!items) {
		return <>{children}</>;
	}

	return (
		<ContextMenu onOpenChange={onOpenChange}>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-[220px] rounded-none">
				<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
					{node.label}
				</ContextMenuLabel>
				{items}
			</ContextMenuContent>
		</ContextMenu>
	);
}

// Menu de lote: aparece ao clicar com o botão direito num nó já selecionado. As ações são as da
// origem comum da seleção (origin-exclusiva), e `tasks` já chega filtrado (task → exclui as de
// origem). loose = vincular; task = mover/soltar; folder = mover.
export function TreeBatchMenu({
	origin,
	count,
	tasks,
	onPickTask,
	onUnlink,
	onOpenChange,
	children,
}: {
	origin: "loose" | "task" | "folder";
	count: number;
	tasks: TaskOption[];
	onPickTask: (taskId: string) => void;
	onUnlink: () => void;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}) {
	return (
		<ContextMenu onOpenChange={onOpenChange}>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent className="w-[220px] rounded-none">
				<ContextMenuLabel className="px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
					{count} selecionada{count > 1 ? "s" : ""}
				</ContextMenuLabel>
				<TaskPickerSub
					label={origin === "loose" ? "Vincular a tarefa" : "Mover para tarefa"}
					tasks={tasks}
					onPick={onPickTask}
				/>
				{origin === "task" && (
					<ContextMenuItem onSelect={onUnlink} className="px-3 py-2">
						<Unlink className="mr-2 size-4" />
						Soltar no vault
					</ContextMenuItem>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
