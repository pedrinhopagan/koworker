import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowDownAZ,
	ChevronDown,
	ChevronRight,
	Clock,
	Flame,
	LayoutGrid,
	Pencil,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TaskGroup } from "@/types/tasks";

// Paleta sóbria pros grupos novos; cicla pela quantidade já existente.
const GROUP_PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

// Modo de ordenação dentro dos grupos. "categoria" clusteriza por categoria (padrão); os demais
// achatam o grupo e ordenam pela chave. É preferência de UI — vive no localStorage, não no banco.
export type SortMode = "categoria" | "prioridade" | "recente" | "alfabetica";

const SORT_MODE_KEY = "tarefas:sortMode";
const SORT_MODES: { mode: SortMode; label: string; icon: typeof LayoutGrid }[] = [
	{ mode: "categoria", label: "Categoria", icon: LayoutGrid },
	{ mode: "prioridade", label: "Prioridade", icon: Flame },
	{ mode: "recente", label: "Recente", icon: Clock },
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
	const mode: SortMode = isSortMode(stored) ? stored : "categoria";

	const setMode = useCallback((next: SortMode) => {
		localStorage.setItem(SORT_MODE_KEY, next);
		// useSyncExternalStore só ouve "storage" (outras abas); dispara no mesmo documento também.
		window.dispatchEvent(new StorageEvent("storage", { key: SORT_MODE_KEY }));
	}, []);

	return [mode, setMode];
}

function SortModeControl({
	value,
	onChange,
}: {
	value: SortMode;
	onChange: (mode: SortMode) => void;
}) {
	return (
		<div className="flex items-center gap-0.5 rounded-md border border-border/60 p-0.5">
			{SORT_MODES.map(({ mode, label, icon: Icon }) => (
				<Button
					key={mode}
					type="button"
					variant={value === mode ? "secondary" : "ghost"}
					size="sm"
					className={cn("h-7 gap-1.5 px-2", value !== mode && "text-muted-foreground")}
					onClick={() => onChange(mode)}
				>
					<Icon className="size-3.5" />
					{label}
				</Button>
			))}
		</div>
	);
}

function invalidateGroups(queryClient: ReturnType<typeof useQueryClient>) {
	queryClient.invalidateQueries({
		predicate: (q: { queryKey: QueryKey }) =>
			Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "taskGroups",
	});
}

type TaskGroupsToolbarProps = {
	projectId: string | null;
	sortMode: SortMode;
	onSortModeChange: (mode: SortMode) => void;
};

export function TaskGroupsToolbar({
	projectId,
	sortMode,
	onSortModeChange,
}: TaskGroupsToolbarProps) {
	const queryClient = useQueryClient();
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");

	const groupsQuery = useQuery({
		...orpc.taskGroups.list.queryOptions({ input: { projectId: projectId ?? "" } }),
		enabled: Boolean(projectId),
	});

	const createMutation = useMutation({
		...orpc.taskGroups.create.mutationOptions(),
		onSuccess: () => {
			invalidateGroups(queryClient);
			setName("");
			setCreating(false);
		},
	});

	if (!projectId) return null;

	function submit() {
		const trimmed = name.trim();
		if (!trimmed) return;
		const color = GROUP_PALETTE[(groupsQuery.data?.length ?? 0) % GROUP_PALETTE.length];
		createMutation.mutate({ projectId: projectId!, name: trimmed, color });
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<SortModeControl value={sortMode} onChange={onSortModeChange} />

			{creating ? (
				<div className="flex items-center gap-2">
					<Input
						autoFocus
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submit();
							if (e.key === "Escape") setCreating(false);
						}}
						placeholder="Nome do grupo"
						className="h-8 w-48"
					/>
					<Button size="sm" onClick={submit} disabled={createMutation.isPending}>
						Criar
					</Button>
					<Button variant="ghost" size="icon-sm" onClick={() => setCreating(false)}>
						<X className="size-4" />
					</Button>
				</div>
			) : (
				<Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
					<Plus className="size-4" />
					Novo grupo
				</Button>
			)}
		</div>
	);
}

type TaskGroupHeaderProps = {
	group?: TaskGroup;
	count: number;
	collapsed: boolean;
	onToggleCollapse: () => void;
};

export function TaskGroupHeader({
	group,
	count,
	collapsed,
	onToggleCollapse,
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

	return (
		<div className="group/header flex items-center gap-2 border-border/60 border-b pb-1">
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
						{group?.name ?? "Sem grupo"}
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

			{group && !editing && (
				<div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/header:opacity-100">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Renomear grupo"
						onClick={() => {
							setName(group.name);
							setEditing(true);
						}}
					>
						<Pencil className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Remover grupo"
						onClick={() => setConfirmDelete(true)}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			)}

			{group && (
				<ConfirmDialog
					open={confirmDelete}
					onClose={() => setConfirmDelete(false)}
					onConfirm={() => {
						deleteMutation.mutate({ id: group.id });
						setConfirmDelete(false);
					}}
					title={`Remover o grupo "${group.name}"?`}
					description="As tarefas dele voltam para “Sem grupo”. Esta ação não pode ser desfeita."
					confirmLabel="Remover"
					variant="danger"
				/>
			)}
		</div>
	);
}
