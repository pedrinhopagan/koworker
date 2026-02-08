import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import {
	DragHandle,
	type SortableItemRenderProps,
	SortableList,
} from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import type { SubtaskFull, TaskFull } from "@/types/tasks";

import { useTaskSubtasksMutations } from "../-utils/use-task-subtasks-mutations";
import { ParentTaskSelectionRow, SubtaskItem } from "./subtask-item";

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
	const [newTitle, setNewTitle] = useState("");

	const subtasks = task.subtasks ?? [];
	const doneCount = subtasks.filter((subtask) => subtask.status === "executed").length;
	const sortedSubtasks = useMemo(
		() => [...subtasks].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[subtasks],
	);
	const [orderedSubtasks, setOrderedSubtasks] = useState<SubtaskFull[]>([]);
	const taskQueryOptions = orpc.tasks.getFull.queryOptions({ input: { id: task.id } });
	const { addMutation, reorderMutation, addSubtask, reorderSubtasks } = useTaskSubtasksMutations({
		taskId: task.id,
		taskQueryKey: taskQueryOptions.queryKey,
	});

	useEffect(() => {
		setOrderedSubtasks((previous) => {
			if (
				previous.length === sortedSubtasks.length &&
				previous.every((item, index) => item.id === sortedSubtasks[index]?.id)
			) {
				return previous;
			}
			return sortedSubtasks;
		});
	}, [sortedSubtasks]);

	function handleAdd() {
		if (!newTitle.trim()) {
			return;
		}
		addSubtask(newTitle);
		setNewTitle("");
	}

	function handleKeyDown(event: React.KeyboardEvent) {
		if (event.key === "Enter") {
			handleAdd();
		}
	}

	function handleReorder(items: SubtaskFull[]) {
		setOrderedSubtasks(items);
		reorderSubtasks(items);
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
					<SubtaskItem
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
								<SubtaskItem
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
									onChange={(event) => setNewTitle(event.target.value)}
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
