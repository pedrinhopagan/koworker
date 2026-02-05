import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { tv } from "tailwind-variants";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DragHandle,
	type SortableItemRenderProps,
	SortableList,
} from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import type { SubtaskFull, TaskFull } from "@/types/tasks";

const subtaskItemVariants = tv({
	slots: {
		root: "group",
		row: "flex items-center gap-3 px-3 py-2 bg-card hover:bg-popover border-l-2",
		checkbox: "text-muted-foreground shrink-0",
		chevron: "text-muted-foreground transition-transform shrink-0",
		title: "flex-1 text-sm text-foreground min-w-0 truncate",
		hint: "text-xs text-muted-foreground shrink-0",
		remove: "p-1 text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0",
		content: "pl-9 px-3 pb-1 space-y-2 border-l-2 border-border bg-card",
		label: "text-xs uppercase tracking-wide text-muted-foreground",
		textarea: cn(
			"w-full resize-none border border-border bg-background px-3 py-2",
			"text-sm text-foreground transition-colors",
			"focus:border-primary focus:outline-none",
			"disabled:cursor-not-allowed disabled:opacity-50",
		),
	},
	variants: {
		done: {
			true: {
				row: "opacity-60",
				checkbox: "text-primary",
				title: "line-through text-muted-foreground",
			},
		},
		selectionMode: {
			true: {
				row: "cursor-pointer hover:bg-accent/10",
			},
		},
		selected: {
			true: {
				row: "bg-accent/20 hover:bg-accent/30",
			},
		},
	},
});

type SubtaskItemV1Props = {
	subtask: SubtaskFull;
	disabled?: boolean;
	selectionMode?: boolean;
	isSelected?: boolean;
	onToggleSelection?: (id: string) => void;
};

function SubtaskItemV1({
	subtask,
	disabled,
	selectionMode,
	isSelected,
	onToggleSelection,
}: SubtaskItemV1Props) {
	const queryClient = useQueryClient();
	const [expanded, setExpanded] = useState(false);
	const [localDescription, setLocalDescription] = useState(subtask.description ?? "");

	const isDone = subtask.status === "executed";
	const hasDetails = Boolean(subtask.description);
	const styles = subtaskItemVariants({
		done: isDone,
		selectionMode,
		selected: isSelected,
	});

	const updateMutation = useMutation({
		...orpc.subtasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "subtasks",
			});
		},
	});

	const removeMutation = useMutation({
		...orpc.subtasks.remove.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "subtasks",
			});
		},
	});

	const isMutating = updateMutation.isPending || removeMutation.isPending;

	function handleToggle(e: React.MouseEvent) {
		e.stopPropagation();
		const newStatus = isDone ? "pending" : "executed";
		const completedAt = newStatus === "executed" ? Date.now() : null;
		updateMutation.mutate({ id: subtask.id, status: newStatus, completedAt });
	}

	function handleRemove(e: React.MouseEvent) {
		e.stopPropagation();
		removeMutation.mutate({ id: subtask.id });
	}

	function handleDescriptionBlur() {
		const newDesc = localDescription || undefined;
		if (newDesc !== (subtask.description ?? undefined)) {
			updateMutation.mutate({ id: subtask.id, description: newDesc });
		}
	}

	function handleRowClick() {
		if (selectionMode && onToggleSelection && !disabled) {
			onToggleSelection(subtask.id);
		}
	}

	function handleSelectionChange() {
		if (onToggleSelection && !disabled) {
			onToggleSelection(subtask.id);
		}
	}

	function handleToggleDetails(event: React.MouseEvent) {
		event.stopPropagation();
		if (disabled) return;
		setExpanded(!expanded);
	}

	const isSelectable = Boolean(selectionMode && onToggleSelection && !disabled);

	return (
		<div className={styles.root()}>
			<div
				className={cn(styles.row(), expanded ? "border-border" : "border-transparent")}
				onClick={handleRowClick}
				onKeyDown={(event) => {
					if (!isSelectable) return;
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onToggleSelection?.(subtask.id);
					}
				}}
				role={isSelectable ? "button" : undefined}
				tabIndex={isSelectable ? 0 : undefined}
			>
				{selectionMode ? (
					<span className={styles.checkbox()} aria-hidden>
						{isDone ? "[x]" : "[ ]"}
					</span>
				) : (
					<button
						type="button"
						onClick={handleToggle}
						disabled={disabled || isMutating}
						className={styles.checkbox()}
					>
						{isDone ? "[x]" : "[ ]"}
					</button>
				)}

				<button
					type="button"
					onClick={handleToggleDetails}
					disabled={disabled}
					className={styles.chevron()}
				>
					<ChevronRight size={14} className={cn("transition-transform", expanded && "rotate-90")} />
				</button>

				<span className={styles.title()}>{subtask.title}</span>

				{!expanded && hasDetails && <span className={styles.hint()}>(detalhes)</span>}

				{selectionMode ? (
					<span className="p-1 shrink-0">
						<Checkbox
							size="sm"
							checked={isSelected}
							onCheckedChange={handleSelectionChange}
							onClick={(e) => e.stopPropagation()}
							disabled={disabled}
							aria-label={`Selecionar subtask: ${subtask.title}`}
						/>
					</span>
				) : (
					<button
						type="button"
						onClick={handleRemove}
						disabled={disabled || isMutating}
						className={styles.remove()}
						title="Remover subtask"
					>
						<X size={14} />
					</button>
				)}
			</div>

			{expanded && (
				<div className={styles.content()}>
					<div className="pt-1 pl-6">
						<div className={styles.label()}>Descricao</div>
						{selectionMode ? (
							<Text size="sm" tone="muted" className="whitespace-pre-wrap">
								{subtask.description?.trim() || "Sem descricao"}
							</Text>
						) : (
							<textarea
								value={localDescription}
								onChange={(e) => setLocalDescription(e.target.value)}
								onBlur={handleDescriptionBlur}
								disabled={disabled || isMutating}
								placeholder="Descreva a subtask..."
								className={styles.textarea()}
								rows={6}
							/>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

type ParentTaskSelectionRowProps = {
	title: string;
	status: string;
	selected: boolean;
	disabled?: boolean;
	onToggle?: () => void;
};

function ParentTaskSelectionRow({
	title,
	status,
	selected,
	disabled,
	onToggle,
}: ParentTaskSelectionRowProps) {
	const isDone = status === "executed";
	const styles = subtaskItemVariants({
		done: isDone,
		selectionMode: true,
		selected,
	});
	const isSelectable = Boolean(onToggle && !disabled);

	function handleToggle() {
		if (!isSelectable) return;
		onToggle?.();
	}

	return (
		<div className={styles.root()}>
			<div
				className={cn(
					styles.row(),
					"border-primary/70 bg-primary/10 ring-1 ring-primary/25",
					isSelectable && "cursor-pointer",
				)}
				onClick={handleToggle}
				onKeyDown={(event) => {
					if (!isSelectable) return;
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onToggle?.();
					}
				}}
				role={isSelectable ? "button" : undefined}
				tabIndex={isSelectable ? 0 : undefined}
			>
				<span className={styles.checkbox()} aria-hidden>
					{isDone ? "[x]" : "[ ]"}
				</span>
				<span className={cn(styles.chevron(), "opacity-40")} aria-hidden>
					<ChevronRight size={14} />
				</span>
				<div className="flex items-center gap-2 min-w-0 flex-1">
					<span className={styles.title()}>{title}</span>
					<Badge variant="warning" className="text-[10px] px-2 py-0">
						Principal
					</Badge>
				</div>
				<span className="p-1 shrink-0">
					<Checkbox
						size="sm"
						checked={selected}
						onCheckedChange={handleToggle}
						onClick={(event) => event.stopPropagation()}
						disabled={disabled}
						aria-label="Selecionar tarefa principal"
					/>
				</span>
			</div>
		</div>
	);
}

type TaskSubtasksProps = {
	task: NonNullable<TaskFull>;
	disabled?: boolean;
	selectionMode?: boolean;
	selectedIds?: string[];
	selectedParentTask?: boolean;
	onToggleSelection?: (id: string) => void;
	onToggleParentTask?: () => void;
	onSelectAll?: () => void;
	onClearSelection?: () => void;
};

export function TaskSubtasks({
	task,
	disabled,
	selectionMode,
	selectedIds = [],
	selectedParentTask = false,
	onToggleSelection,
	onToggleParentTask,
	onSelectAll,
	onClearSelection,
}: TaskSubtasksProps) {
	const queryClient = useQueryClient();
	const [newTitle, setNewTitle] = useState("");

	const subtasks = task.subtasks ?? [];
	const doneCount = subtasks.filter((s) => s.status === "executed").length;
	const sortedSubtasks = useMemo(
		() => [...subtasks].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[subtasks],
	);
	const [orderedSubtasks, setOrderedSubtasks] = useState<SubtaskFull[]>([]);
	const invalidateTimeoutRef = useRef<number | null>(null);
	const taskQueryOptions = orpc.tasks.getFull.queryOptions({ input: { id: task.id } });
	const taskQueryKey = taskQueryOptions.queryKey;

	useEffect(() => {
		setOrderedSubtasks((prev) => {
			if (
				prev.length === sortedSubtasks.length &&
				prev.every((item, i) => item.id === sortedSubtasks[i]?.id)
			) {
				return prev;
			}
			return sortedSubtasks;
		});
	}, [sortedSubtasks]);

	useEffect(() => {
		return () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
		};
	}, []);

	const addMutation = useMutation({
		...orpc.subtasks.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "subtasks",
			});
		},
	});

	const reorderMutation = useMutation({
		...orpc.subtasks.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: taskQueryKey });
			const previous = queryClient.getQueryData(taskQueryKey) as TaskFull | undefined;

			if (previous?.subtasks) {
				const byId = new Map(previous.subtasks.map((subtask) => [subtask.id, subtask] as const));
				const nextSubtasks = orderedIds
					.map((id, index) => {
						const item = byId.get(id);
						return item ? { ...item, displayOrder: index } : null;
					})
					.filter(Boolean) as SubtaskFull[];
				queryClient.setQueryData(taskQueryKey, { ...previous, subtasks: nextSubtasks });
			}

			return { previous };
		},
		onError: (_error, _vars, ctx) => {
			if (ctx?.previous) queryClient.setQueryData(taskQueryKey, ctx.previous);
		},
		onSettled: () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: taskQueryKey });
				queryClient.invalidateQueries({
					predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
				});
				queryClient.invalidateQueries({
					predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "subtasks",
				});
			}, 350);
		},
	});

	function handleAdd() {
		if (!newTitle.trim()) return;
		addMutation.mutate({ taskId: task.id, title: newTitle.trim() });
		setNewTitle("");
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			handleAdd();
		}
	}

	function handleReorder(items: SubtaskFull[]) {
		setOrderedSubtasks(items);
		reorderMutation.mutate({ orderedIds: items.map((item) => item.id) });
	}

	function renderSortableItem(subtask: SubtaskFull, props: SortableItemRenderProps) {
		return (
			<div className={cn("flex items-start gap-2", props.isDragging && "opacity-60")}>
				<div className="flex items-start pt-2">
					<DragHandle
						attributes={props.dragHandleProps.attributes}
						listeners={props.dragHandleProps.listeners}
						disabled={disabled || addMutation.isPending || reorderMutation.isPending}
					/>
				</div>
				<div className="flex-1 min-w-0">
					<SubtaskItemV1
						subtask={subtask}
						disabled={disabled || addMutation.isPending || reorderMutation.isPending}
					/>
				</div>
			</div>
		);
	}

	function renderDragOverlay(subtask: SubtaskFull) {
		return <div className="rounded bg-card px-3 py-2 text-sm shadow-lg">{subtask.title}</div>;
	}

	const selectedCount = selectedIds.length + (selectedParentTask ? 1 : 0);
	const reorderDisabled = disabled || addMutation.isPending || reorderMutation.isPending;

	return (
		<Accordion type="single" collapsible defaultValue="subtasks">
			<AccordionItem value="subtasks" className="border-none">
				<AccordionTrigger className="hover:no-underline px-0">
					<div className="flex items-center justify-between gap-2 w-full">
						<div className="flex items-center gap-2">
							<Text size="xs" tone="muted" className="uppercase tracking-wide">
								Subtasks
							</Text>
							{subtasks.length > 0 && !selectionMode && (
								<Text size="xs" tone="muted">
									{doneCount}/{subtasks.length} concluídas
								</Text>
							)}
							{selectionMode && (
								<Badge variant="warning" className="ml-2 animate-pulse">
									Selecionando... {selectedCount}
								</Badge>
							)}
						</div>
					</div>
				</AccordionTrigger>
				<AccordionContent className="pt-2 pb-0">
					{selectionMode && (
						<div className="flex flex-wrap items-center justify-between gap-2 pb-2">
							<Text size="xs" tone="muted">
								{selectedCount} selecionada(s)
							</Text>
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={(event) => {
										event.preventDefault();
										onSelectAll?.();
									}}
									disabled={disabled || addMutation.isPending}
									className="h-6 px-2 text-xs"
								>
									Selecionar todas
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={(event) => {
										event.preventDefault();
										onClearSelection?.();
									}}
									disabled={disabled || addMutation.isPending}
									className="h-6 px-2 text-xs"
								>
									Remover todas
								</Button>
							</div>
						</div>
					)}
					<div
						className={cn(
							"space-y-1 transition-all",
							selectionMode && "rounded ring-1 ring-accent/40",
						)}
					>
						{selectionMode && (
							<ParentTaskSelectionRow
								title={task.title}
								status={task.status}
								selected={selectedParentTask}
								disabled={disabled || addMutation.isPending}
								onToggle={onToggleParentTask}
							/>
						)}
						{subtasks.length === 0 ? (
							<div className="py-4 text-center border border-dashed border-border text-sm text-muted-foreground">
								Nenhuma subtask ainda
							</div>
						) : selectionMode ? (
							sortedSubtasks.map((subtask) => (
								<SubtaskItemV1
									key={subtask.id}
									subtask={subtask}
									disabled={disabled || addMutation.isPending}
									selectionMode={selectionMode}
									isSelected={selectedIds.includes(subtask.id)}
									onToggleSelection={onToggleSelection}
								/>
							))
						) : (
							<SortableList
								items={orderedSubtasks}
								onReorder={handleReorder}
								renderItem={renderSortableItem}
								renderDragOverlay={renderDragOverlay}
								disabled={reorderDisabled}
								itemClassName=""
							/>
						)}

						{!selectionMode && (
							<div className="flex items-center gap-2 pt-2">
								<Plus className="size-4 text-muted-foreground" />
								<input
									type="text"
									value={newTitle}
									onChange={(e) => setNewTitle(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Adicionar subtask..."
									disabled={disabled || addMutation.isPending}
									className={cn(
										"flex-1 bg-transparent text-foreground text-sm",
										"focus:outline-none border-b border-transparent focus:border-primary transition-colors",
										"placeholder:text-muted-foreground/60 disabled:opacity-50 disabled:cursor-not-allowed",
									)}
								/>
								<button
									type="button"
									onClick={handleAdd}
									disabled={!newTitle.trim() || disabled || addMutation.isPending}
									className={cn(
										"px-3 py-1 text-xs bg-primary text-primary-foreground",
										"hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
									)}
								>
									Adicionar
								</button>
							</div>
						)}
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
