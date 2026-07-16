import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ArrowDownAZ,
	ChevronDown,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Clock,
	Flame,
	Gauge,
	LayoutGrid,
	Palette,
	Pencil,
	Plus,
	Search,
	SlidersHorizontal,
	Trash2,
	X,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState, useSyncExternalStore } from "react";

import { orpc, type RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import {
	COMPLEXITY_COLORS,
	COMPLEXITY_LABELS,
	TASK_COMPLEXITIES,
	type TaskComplexity,
} from "@/constants/complexity";
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
import { CustomSelect } from "@/components/ui/custom-select";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TaskGroup } from "@/types/tasks";

// Paleta sóbria pros grupos novos; cicla pela quantidade já existente.
const GROUP_PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

const TASK_TYPE_ALL_ID = "__all_task_type__";
const PRIORITY_ALL_ID = "__all_priority__";
const COMPLEXITY_ALL_ID = "__all_complexity__";

type Category = RouterOutputs["categories"]["list"][number];
type Priority = RouterOutputs["priorities"]["list"][number];

export type SortMode = "categoria" | "prioridade" | "complexidade" | "recente" | "alfabetica";

const SORT_MODE_KEY = "tarefas:sortMode";
const SORT_MODES: { mode: SortMode; label: string; icon: typeof LayoutGrid }[] = [
	{ mode: "recente", label: "Recente", icon: Clock },
	{ mode: "categoria", label: "Categoria", icon: LayoutGrid },
	{ mode: "prioridade", label: "Prioridade", icon: Flame },
	{ mode: "complexidade", label: "Complexidade", icon: Gauge },
	{ mode: "alfabetica", label: "A-Z", icon: ArrowDownAZ },
];

function isSortMode(value: string | null): value is SortMode {
	return SORT_MODES.some((m) => m.mode === value);
}

export function useSortMode(): [SortMode, (mode: SortMode) => void] {
	const subscribe = useCallback((onChange: () => void) => {
		window.addEventListener("storage", onChange);
		return () => window.removeEventListener("storage", onChange);
	}, []);
	const stored = useSyncExternalStore(
		subscribe,
		() => localStorage.getItem(SORT_MODE_KEY),
		() => null,
	);
	const mode: SortMode = isSortMode(stored) ? stored : "recente";

	const setMode = useCallback((next: SortMode) => {
		localStorage.setItem(SORT_MODE_KEY, next);
		// useSyncExternalStore só ouve "storage" (outras abas); dispara no mesmo documento também.
		window.dispatchEvent(new StorageEvent("storage", { key: SORT_MODE_KEY }));
	}, []);

	return [mode, setMode];
}

function invalidateGroups(queryClient: ReturnType<typeof useQueryClient>) {
	queryClient.invalidateQueries({
		predicate: (q: { queryKey: QueryKey }) =>
			Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "taskGroups",
	});
}

type TaskSearchValue = {
	q?: string;
	taskTypeId?: string;
	priorityId?: string;
	complexity?: TaskComplexity;
	includeCompleted?: boolean;
};

// Select de filtro com contraste: fundo mais escuro (bg-background) que o popover (bg-card) para
// não se dissolver na superfície.
function FilterSelect<T extends { id: string; name: string; color: string; level?: number }>({
	items,
	value,
	allId,
	placeholder,
	onValueChange,
}: {
	items: T[];
	value: string;
	allId: string;
	placeholder: string;
	onValueChange: (next: string | undefined) => void;
}) {
	const selected = items.find((item) => item.id === value && item.id !== allId) ?? null;

	return (
		<CustomSelect
			items={items}
			value={value}
			onValueChange={(newValue) => onValueChange(newValue === allId ? undefined : newValue)}
			renderTrigger={() => (
				<>
					<span className="flex min-w-0 items-center gap-2 text-foreground">
						<span
							className={cn("size-2 shrink-0 rounded-full", !selected && "bg-muted-foreground")}
							style={selected ? { backgroundColor: selected.color } : undefined}
						/>
						<span className="truncate">{selected?.name ?? placeholder}</span>
					</span>
					<ChevronDown className="ml-1 size-4 text-muted-foreground" />
				</>
			)}
			renderItem={(item, isSelected) => (
				<div
					className={cn("flex w-full items-center gap-2 px-3 py-2", isSelected && "font-medium")}
				>
					<span
						className="size-2 shrink-0 rounded-full"
						style={{ backgroundColor: item.color ?? "#6b7280" }}
					/>
					<span className="truncate">{item.name}</span>
					{typeof item.level === "number" && item.level > 0 && (
						<span className="text-muted-foreground text-xs">{item.level}</span>
					)}
				</div>
			)}
			label={placeholder}
			triggerClassName="w-full bg-background"
		/>
	);
}

function TaskFiltersPanel({
	value,
	categories,
	priorities,
	onChange,
}: {
	value: TaskSearchValue;
	categories: Category[];
	priorities: Priority[];
	onChange: (next: TaskSearchValue) => void;
}) {
	const taskTypeItems = useMemo(
		() => [
			{ id: TASK_TYPE_ALL_ID, name: "Todos os tipos", color: "#6b7280" },
			...categories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
		],
		[categories],
	);

	const priorityItems = useMemo(
		() => [
			{ id: PRIORITY_ALL_ID, name: "Todas as prioridades", color: "#6b7280", level: 0 },
			...priorities.map((p) => ({ id: p.id, name: p.name, color: p.color, level: p.level })),
		],
		[priorities],
	);

	const complexityItems = [
		{ id: COMPLEXITY_ALL_ID, name: "Todas as complexidades", color: "#6b7280" },
		...TASK_COMPLEXITIES.map((c) => ({
			id: c,
			name: COMPLEXITY_LABELS[c],
			color: COMPLEXITY_COLORS[c],
		})),
	];

	const activeFilters = [
		value.taskTypeId,
		value.priorityId,
		value.complexity,
		value.includeCompleted ? "done" : undefined,
	].filter(Boolean).length;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<Text size="sm" className="font-medium">
					Filtros
				</Text>
				{activeFilters > 0 && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-muted-foreground"
						onClick={() =>
							onChange({
								...value,
								taskTypeId: undefined,
								priorityId: undefined,
								complexity: undefined,
								includeCompleted: undefined,
							})
						}
					>
						<X className="size-3.5" />
						Limpar
					</Button>
				)}
			</div>

			<div className="space-y-1">
				<Text size="xs" className="font-medium">
					Tipo
				</Text>
				<FilterSelect
					items={taskTypeItems}
					value={value.taskTypeId ?? TASK_TYPE_ALL_ID}
					allId={TASK_TYPE_ALL_ID}
					placeholder="Todos os tipos"
					onValueChange={(taskTypeId) => onChange({ ...value, taskTypeId })}
				/>
			</div>

			<div className="space-y-1">
				<Text size="xs" className="font-medium">
					Prioridade
				</Text>
				<FilterSelect
					items={priorityItems}
					value={value.priorityId ?? PRIORITY_ALL_ID}
					allId={PRIORITY_ALL_ID}
					placeholder="Todas as prioridades"
					onValueChange={(priorityId) => onChange({ ...value, priorityId })}
				/>
			</div>

			<div className="space-y-1">
				<Text size="xs" className="font-medium">
					Complexidade
				</Text>
				<FilterSelect
					items={complexityItems}
					value={value.complexity ?? COMPLEXITY_ALL_ID}
					allId={COMPLEXITY_ALL_ID}
					placeholder="Todas as complexidades"
					onValueChange={(complexity) =>
						onChange({ ...value, complexity: complexity as TaskComplexity | undefined })
					}
				/>
			</div>

			<label className="flex cursor-pointer items-center justify-between gap-2">
				<Text size="xs" className="font-medium">
					Ver concluídas
				</Text>
				<Switch
					checked={Boolean(value.includeCompleted)}
					onCheckedChange={(checked) =>
						onChange({ ...value, includeCompleted: checked || undefined })
					}
					size="default"
				/>
			</label>
		</div>
	);
}

function FiltersPopover({
	value,
	categories,
	priorities,
	onChange,
}: {
	value: TaskSearchValue;
	categories: Category[];
	priorities: Priority[];
	onChange: (next: TaskSearchValue) => void;
}) {
	const activeFilters = [
		value.taskTypeId,
		value.priorityId,
		value.complexity,
		value.includeCompleted ? "done" : undefined,
	].filter(Boolean).length;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant={activeFilters > 0 ? "secondary" : "ghost"}
					size="sm"
					aria-label="Filtros"
					className="relative"
				>
					<SlidersHorizontal className="size-4" />
					Filtros
					{activeFilters > 0 && (
						<span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
							{activeFilters}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64 space-y-3 p-3">
				<TaskFiltersPanel
					value={value}
					categories={categories}
					priorities={priorities}
					onChange={onChange}
				/>
			</PopoverContent>
		</Popover>
	);
}

function Divider() {
	return <div className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

type TaskListControlsProps = {
	projectId: string | null;
	search: { value: TaskSearchValue; onChange: (next: TaskSearchValue) => void };
	categories: Category[];
	priorities: Priority[];
	sortMode: SortMode;
	onSortModeChange: (mode: SortMode) => void;
	onCollapseAll: () => void;
	onExpandAll: () => void;
};

export function TaskListControls({
	projectId,
	search,
	categories,
	priorities,
	sortMode,
	onSortModeChange,
	onCollapseAll,
	onExpandAll,
}: TaskListControlsProps) {
	const queryClient = useQueryClient();
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

	const groupsQuery = orpc.taskGroups.list.queryOptions({ input: { projectId: projectId ?? "" } });
	const createMutation = useMutation({
		...orpc.taskGroups.create.mutationOptions(),
		onSuccess: () => {
			invalidateGroups(queryClient);
			setName("");
			setCreating(false);
		},
	});

	function submit() {
		const trimmed = name.trim();
		if (!trimmed || !projectId) return;
		const existing = queryClient.getQueryData<TaskGroup[]>(groupsQuery.queryKey) ?? [];
		const color = GROUP_PALETTE[existing.length % GROUP_PALETTE.length];
		createMutation.mutate({ projectId, name: trimmed, color });
	}

	const activeFilters = [
		search.value.taskTypeId,
		search.value.priorityId,
		search.value.complexity,
		search.value.includeCompleted ? "done" : undefined,
	].filter(Boolean).length;

	const mobileControlsActive = activeFilters > 0 || sortMode !== "recente";

	function searchInput(className?: string) {
		return (
			<div className={cn("relative", className)}>
				<Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
				<Input
					placeholder="Buscar tarefas..."
					value={search.value.q ?? ""}
					onChange={(event) => {
						const next = event.target.value;
						search.onChange({ ...search.value, q: next.trim().length > 0 ? next : undefined });
					}}
					className="h-9 pl-8"
				/>
			</div>
		);
	}

	function newFeatureControls(fullWidth?: boolean) {
		if (!projectId) return null;

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

	return (
		<>
			<div className="flex flex-col gap-2 md:hidden">
				{searchInput("w-full")}
				<Button
					type="button"
					variant={mobileControlsActive ? "secondary" : "outline"}
					size="sm"
					className="h-12 w-full"
					onClick={() => setMobileSheetOpen(true)}
				>
					<SlidersHorizontal className="size-4" />
					Filtros e ordenação
					{mobileControlsActive && (
						<span className="ml-auto flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
							{activeFilters + (sortMode === "recente" ? 0 : 1)}
						</span>
					)}
				</Button>
			</div>

			<div className="hidden items-center gap-1 md:flex">
				{searchInput("flex-1")}

				<FiltersPopover
					value={search.value}
					categories={categories}
					priorities={priorities}
					onChange={search.onChange}
				/>

				<Divider />

				{SORT_MODES.map(({ mode, label, icon: Icon }) => (
					<Tooltip key={mode} label={label}>
						<Button
							type="button"
							variant={sortMode === mode ? "secondary" : "ghost"}
							size="icon-sm"
							aria-label={label}
							className={cn(sortMode !== mode && "text-muted-foreground")}
							onClick={() => onSortModeChange(mode)}
						>
							<Icon className="size-4" />
						</Button>
					</Tooltip>
				))}

				<Tooltip label="Colapsar tudo">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Colapsar tudo"
						className="text-muted-foreground"
						onClick={onCollapseAll}
					>
						<ChevronsDownUp className="size-4" />
					</Button>
				</Tooltip>
				<Tooltip label="Expandir tudo">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Expandir tudo"
						className="text-muted-foreground"
						onClick={onExpandAll}
					>
						<ChevronsUpDown className="size-4" />
					</Button>
				</Tooltip>

				{projectId && <Divider />}

				{newFeatureControls()}
			</div>

			<Drawer
				open={mobileSheetOpen}
				onClose={() => setMobileSheetOpen(false)}
				side="right"
				title="Filtros e ordenação"
			>
				<div className="space-y-6">
					<TaskFiltersPanel
						value={search.value}
						categories={categories}
						priorities={priorities}
						onChange={search.onChange}
					/>

					<div className="space-y-2">
						<Text size="sm" className="font-medium">
							Ordenação
						</Text>
						<div className="grid grid-cols-2 gap-3">
							{SORT_MODES.map(({ mode, label, icon: Icon }) => (
								<Button
									key={mode}
									type="button"
									variant={sortMode === mode ? "secondary" : "outline"}
									size="sm"
									className="h-12 justify-start gap-2"
									onClick={() => onSortModeChange(mode)}
								>
									<Icon className="size-4 shrink-0" />
									{label}
								</Button>
							))}
						</div>
					</div>

					<div className="space-y-2">
						<Text size="sm" className="font-medium">
							Grupos
						</Text>
						<div className="grid grid-cols-2 gap-3">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-12 justify-start gap-2"
								onClick={onCollapseAll}
							>
								<ChevronsDownUp className="size-4" />
								Colapsar tudo
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-12 justify-start gap-2"
								onClick={onExpandAll}
							>
								<ChevronsUpDown className="size-4" />
								Expandir tudo
							</Button>
						</div>
					</div>

					{newFeatureControls(true)}
				</div>
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
	});

	const deleteMutation = useMutation({
		...orpc.taskGroups.delete.mutationOptions(),
		onSuccess: () => {
			invalidateGroups(queryClient);
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

	const header = (
		<div className="group/header flex items-center gap-2 border-border/60 border-b pb-1">
			{dragHandle}
			<button
				type="button"
				onClick={onToggleCollapse}
				className="flex min-w-0 flex-1 items-center gap-2 text-left"
			>
				<ChevronIcon className="size-4 shrink-0 text-muted-foreground" />
				{group ? (
					<span
						className="size-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: group.color }}
					/>
				) : null}
				{editing && group ? null : (
					<Text size="sm" className={cn("truncate font-medium", !group && "text-muted-foreground")}>
						{group?.name ?? "Sem feature"}
					</Text>
				)}
				<Text size="xs" tone="muted" className="shrink-0">
					{count}
				</Text>
			</button>

			{editing && group && (
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
