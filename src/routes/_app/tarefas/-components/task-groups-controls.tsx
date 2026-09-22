import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Palette,
	Pencil,
	Plus,
	Search,
	SlidersHorizontal,
	Trash2,
	X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { TaskGroupLabel } from "@/components/tasks/task-group-label";
import { TASK_SORT_OPTIONS } from "@/components/tasks/task-sort-controls";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import type { TaskSortMode } from "@/constants/tasks";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { errorMessage } from "@/lib/orpc-errors";
import { cn } from "@/lib/utils";
import type { TaskGroup } from "@/types/tasks";

// Paleta sóbria pros grupos novos; cicla pela quantidade já existente.
const GROUP_PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

function invalidateGroups(queryClient: ReturnType<typeof useQueryClient>) {
	queryClient.invalidateQueries({
		predicate: (q: { queryKey: QueryKey }) =>
			Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "taskGroups",
	});
}

type TaskSearchValue = {
	q?: string;
	includeCompleted?: boolean;
};

type TaskListControlsProps = {
	projectId: string | null;
	search: { value: TaskSearchValue; onChange: (next: TaskSearchValue) => void };
	sortMode: TaskSortMode;
	onSortModeChange: (mode: TaskSortMode) => void;
	onCollapseAll: () => void;
	onExpandAll: () => void;
	allowFeatureCreation?: boolean;
};

export function TaskListControls({
	projectId,
	search,
	sortMode,
	onSortModeChange,
	onCollapseAll,
	onExpandAll,
	allowFeatureCreation = true,
}: TaskListControlsProps) {
	const queryClient = useQueryClient();
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
	const [searchDraft, setSearchDraft] = useDebouncedSearch(search.value.q ?? "", (next) => {
		search.onChange({ ...search.value, q: next.trim().length > 0 ? next : undefined });
	});

	const groupsQuery = orpc.taskGroups.list.queryOptions({ input: { projectId: projectId ?? "" } });
	const createMutation = useMutation({
		...orpc.taskGroups.create.mutationOptions(),
		onSuccess: () => {
			invalidateGroups(queryClient);
			setName("");
			setCreating(false);
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível criar a feature")),
	});

	function submit() {
		const trimmed = name.trim();
		if (!trimmed || !projectId) return;
		const existing = queryClient.getQueryData<TaskGroup[]>(groupsQuery.queryKey) ?? [];
		const color = GROUP_PALETTE[existing.length % GROUP_PALETTE.length];
		createMutation.mutate({ projectId, name: trimmed, color });
	}

	const mobileControlsActive = sortMode !== "recente";

	function searchInput(className?: string) {
		return (
			<div className={cn("relative", className)}>
				<Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
				<Input
					placeholder="Buscar tarefas..."
					value={searchDraft}
					onChange={(event) => setSearchDraft(event.target.value)}
					className="h-9 pl-8"
				/>
			</div>
		);
	}

	function newFeatureControls(fullWidth?: boolean) {
		if (!projectId || !allowFeatureCreation) return null;

		if (creating) {
			return (
				<div className={cn("flex items-center gap-1", fullWidth && "w-full")}>
					<Input
						autoFocus
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submit();
							if (e.key === "Escape") setCreating(false);
						}}
						placeholder="Nome da feature"
						className={cn("h-8", fullWidth ? "min-w-0 flex-1" : "w-40")}
					/>
					<Button size="sm" className="h-8" onClick={submit} disabled={createMutation.isPending}>
						Criar
					</Button>
					<Button variant="ghost" size="icon-sm" onClick={() => setCreating(false)}>
						<X className="size-4" />
					</Button>
				</div>
			);
		}

		return (
			<Button
				variant="outline"
				size="sm"
				className={cn("h-8", fullWidth && "w-full")}
				onClick={() => setCreating(true)}
			>
				<Plus className="size-4" />
				Nova feature
			</Button>
		);
	}

	const sectionLabel = "font-semibold uppercase tracking-[0.12em]";

	const controls = (
		<div className="space-y-4">
			<div className="space-y-2">
				<Text size="xs" tone="muted" className={sectionLabel}>
					Ordenação
				</Text>
				<div className="grid grid-cols-2 gap-1.5">
					{TASK_SORT_OPTIONS.map(({ mode, label, icon: Icon }) => (
						<Button
							key={mode}
							type="button"
							size="sm"
							variant={sortMode === mode ? "secondary" : "outline"}
							className="justify-start"
							onClick={() => onSortModeChange(mode)}
						>
							<Icon className="size-4" />
							{label}
						</Button>
					))}
				</div>
			</div>
			<div className="space-y-2">
				<Text size="xs" tone="muted" className={sectionLabel}>
					Grupos
				</Text>
				<div className="grid grid-cols-2 gap-1.5">
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="justify-start"
						onClick={onCollapseAll}
					>
						<ChevronsDownUp className="size-4" />
						Recolher
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="justify-start"
						onClick={onExpandAll}
					>
						<ChevronsUpDown className="size-4" />
						Expandir
					</Button>
				</div>
			</div>
			{newFeatureControls(true)}
		</div>
	);

	const completedButton = (
		<Tooltip label={search.value.includeCompleted ? "Ocultar concluídas" : "Mostrar concluídas"}>
			<Button
				type="button"
				variant={search.value.includeCompleted ? "secondary" : "outline"}
				size="icon-sm"
				className="size-9 shrink-0"
				aria-label={search.value.includeCompleted ? "Ocultar concluídas" : "Mostrar concluídas"}
				aria-pressed={!!search.value.includeCompleted}
				onClick={() =>
					search.onChange({
						...search.value,
						includeCompleted: search.value.includeCompleted ? undefined : true,
					})
				}
			>
				<CheckCircle2 className="size-4" />
			</Button>
		</Tooltip>
	);

	const moreLabel = (
		<>
			<SlidersHorizontal className="size-4" />
			Mais
		</>
	);

	return (
		<>
			<div className="-mx-4 flex flex-col gap-2 md:hidden">
				<div className="flex gap-2">
					{searchInput("min-w-0 flex-1")}
					{completedButton}
					<Button
						type="button"
						variant={mobileControlsActive ? "secondary" : "outline"}
						size="sm"
						className="h-9 shrink-0"
						onClick={() => setMobileSheetOpen(true)}
					>
						{moreLabel}
					</Button>
				</div>
			</div>

			<div className="-mx-4 hidden items-center gap-2 border-b border-border bg-card/35 px-4 py-2 md:flex">
				<div className="min-w-0 max-w-md flex-1">{searchInput()}</div>
				<div className="flex-1" />
				{completedButton}
				<Popover>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant={mobileControlsActive ? "secondary" : "outline"}
							size="sm"
							className="shrink-0"
						>
							{moreLabel}
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-72 p-4">
						{controls}
					</PopoverContent>
				</Popover>
			</div>

			<Drawer
				open={mobileSheetOpen}
				onClose={() => setMobileSheetOpen(false)}
				side="bottom"
				title="Opções da lista"
			>
				{controls}
			</Drawer>
		</>
	);
}

// Menu de botão direito de uma feature (header do task_group): renomear, trocar a cor pela paleta,
// colapsar/expandir e excluir. Substitui os botões de hover — a porta única pras ações da feature.
function FeatureContextMenu({
	group,
	collapsed,
	onRename,
	onSetColor,
	onToggleCollapse,
	onDelete,
	children,
}: {
	group: TaskGroup;
	collapsed: boolean;
	onRename: () => void;
	onSetColor: (color: string) => void;
	onToggleCollapse: () => void;
	onDelete: () => void;
	children: ReactNode;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			{/* Renomear mostra um input com autoFocus; sem isto o menu devolve o foco ao trigger ao
			    fechar, o input perde foco e o onBlur cancela a edição num flash. */}
			<ContextMenuContent
				className="w-[200px] rounded-none"
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				<ContextMenuLabel className="truncate px-3 py-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
					{group.name}
				</ContextMenuLabel>
				<ContextMenuItem onSelect={onRename} className="px-3 py-2">
					<Pencil className="mr-2 size-4" />
					Renomear
				</ContextMenuItem>
				<ContextMenuSub>
					<ContextMenuSubTrigger className="px-3 py-2">
						<Palette className="mr-2 size-4" />
						Editar cor
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className="p-2">
						<div className="flex flex-wrap items-center gap-1">
							{GROUP_PALETTE.map((color) => (
								<ContextMenuItem
									key={color}
									onSelect={() => onSetColor(color)}
									className="size-7 justify-center p-0"
								>
									<span
										className={cn(
											"size-4 rounded-full",
											color.toLowerCase() === group.color.toLowerCase() &&
												"ring-2 ring-foreground ring-offset-1 ring-offset-card",
										)}
										style={{ backgroundColor: color }}
									/>
								</ContextMenuItem>
							))}
						</div>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuItem onSelect={onToggleCollapse} className="px-3 py-2">
					{collapsed ? (
						<ChevronsUpDown className="mr-2 size-4" />
					) : (
						<ChevronsDownUp className="mr-2 size-4" />
					)}
					{collapsed ? "Expandir" : "Colapsar"}
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem
					onSelect={onDelete}
					className="px-3 py-2 text-destructive focus:text-destructive"
				>
					<Trash2 className="mr-2 size-4" />
					Excluir
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

type TaskGroupHeaderProps = {
	group?: TaskGroup;
	count: number;
	collapsed: boolean;
	onToggleCollapse: () => void;
	dragHandle?: ReactNode;
};

export function TaskGroupHeader({
	group,
	count,
	collapsed,
	onToggleCollapse,
	dragHandle,
}: TaskGroupHeaderProps) {
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(group?.name ?? "");
	const [confirmDelete, setConfirmDelete] = useState(false);

	const updateMutation = useMutation({
		...orpc.taskGroups.update.mutationOptions(),
		onSuccess: () => {
			invalidateGroups(queryClient);
			setEditing(false);
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível renomear a feature")),
	});

	const deleteMutation = useMutation({
		...orpc.taskGroups.delete.mutationOptions(),
		onSuccess: () => {
			invalidateGroups(queryClient);
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível remover a feature")),
	});

	const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

	const header = (
		<div className="group/header flex items-center gap-2 border-border/60 border-b px-4 pb-1">
			{dragHandle}
			<button
				type="button"
				onClick={onToggleCollapse}
				className="flex size-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				aria-label={collapsed ? "Expandir feature" : "Recolher feature"}
			>
				<ChevronIcon className="size-4" />
			</button>

			{editing && group ? (
				<Input
					autoFocus
					value={name}
					onChange={(e) => setName(e.target.value)}
					onBlur={() => setEditing(false)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							const trimmed = name.trim();
							if (trimmed && trimmed !== group.name) {
								updateMutation.mutate({ id: group.id, name: trimmed });
							} else {
								setEditing(false);
							}
						}
						if (e.key === "Escape") setEditing(false);
					}}
					className="h-7 w-48"
				/>
			) : group ? (
				<Link
					to="/tarefas/$taskId"
					params={{ taskId: group.id }}
					search={{ projectId: group.projectId }}
					className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<TaskGroupLabel
						name={group.name}
						color={group.color}
						count={count}
						className="min-w-0 flex-1 border-0 pb-0"
					/>
				</Link>
			) : (
				<button
					type="button"
					onClick={onToggleCollapse}
					className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<TaskGroupLabel count={count} className="min-w-0 flex-1 border-0 pb-0" />
				</button>
			)}
		</div>
	);

	// Pseudo-grupo "Sem feature" (group indefinido): sem id, sem menu — só o header colapsável.
	if (!group) {
		return header;
	}

	return (
		<>
			<FeatureContextMenu
				group={group}
				collapsed={collapsed}
				onRename={() => {
					setName(group.name);
					setEditing(true);
				}}
				onSetColor={(color) => updateMutation.mutate({ id: group.id, color })}
				onToggleCollapse={onToggleCollapse}
				onDelete={() => setConfirmDelete(true)}
			>
				{header}
			</FeatureContextMenu>

			<ConfirmDialog
				open={confirmDelete}
				onClose={() => setConfirmDelete(false)}
				onConfirm={() => {
					deleteMutation.mutate({ id: group.id });
					setConfirmDelete(false);
				}}
				title={`Remover a feature "${group.name}"?`}
				description="As tarefas dela voltam para “Sem feature”. Esta ação não pode ser desfeita."
				confirmLabel="Remover"
				variant="danger"
			/>
		</>
	);
}
