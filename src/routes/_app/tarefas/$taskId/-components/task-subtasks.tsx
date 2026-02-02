import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { tv } from "tailwind-variants";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { SubtaskFull, TaskFull } from "@/types/tasks";

const subtaskItemVariants = tv({
	slots: {
		root: "group",
		row: "flex items-center gap-3 px-3 py-2 bg-card hover:bg-popover transition-colors",
		checkbox: "text-muted-foreground transition-colors shrink-0",
		chevron: "text-muted-foreground transition-transform shrink-0",
		title: "flex-1 text-sm text-foreground min-w-0 truncate",
		hint: "text-xs text-muted-foreground shrink-0",
		remove: "p-1 text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0",
		content: "ml-9 px-3 pb-1 space-y-2 border-l-2 border-border bg-background",
		label: "text-xs uppercase tracking-wide text-muted-foreground",
		textarea: cn(
			"w-full resize-none border border-border bg-card px-3 py-2",
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
	},
});

type SubtaskItemV1Props = {
	subtask: SubtaskFull;
	disabled?: boolean;
};

function SubtaskItemV1({ subtask, disabled }: SubtaskItemV1Props) {
	const queryClient = useQueryClient();
	const [expanded, setExpanded] = useState(false);
	const [localDescription, setLocalDescription] = useState(subtask.description ?? "");

	const isDone = subtask.status === "executed";
	const hasDetails = Boolean(subtask.description);
	const styles = subtaskItemVariants({ done: isDone });

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

	return (
		<div className={styles.root()}>
			<div className={styles.row()}>
				<button
					type="button"
					onClick={handleToggle}
					disabled={disabled || isMutating}
					className={styles.checkbox()}
				>
					{isDone ? "[x]" : "[ ]"}
				</button>

				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					disabled={disabled}
					className={styles.chevron()}
				>
					<ChevronRight size={14} className={cn("transition-transform", expanded && "rotate-90")} />
				</button>

				<span className={styles.title()}>{subtask.title}</span>

				{!expanded && hasDetails && <span className={styles.hint()}>(detalhes)</span>}

				<button
					type="button"
					onClick={handleRemove}
					disabled={disabled || isMutating}
					className={styles.remove()}
					title="Remover subtask"
				>
					<X size={14} />
				</button>
			</div>

			{expanded && (
				<div className={styles.content()}>
					<div className="pt-1">
						<div className={styles.label()}>Descrição</div>
						<textarea
							value={localDescription}
							onChange={(e) => setLocalDescription(e.target.value)}
							onBlur={handleDescriptionBlur}
							disabled={disabled || isMutating}
							placeholder="Descreva a subtask..."
							className={styles.textarea()}
							rows={2}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

type TaskSubtasksProps = {
	task: NonNullable<TaskFull>;
	disabled?: boolean;
};

export function TaskSubtasks({ task, disabled }: TaskSubtasksProps) {
	const queryClient = useQueryClient();
	const [newTitle, setNewTitle] = useState("");

	const subtasks = task.subtasks ?? [];
	const doneCount = subtasks.filter((s) => s.status === "executed").length;

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

	return (
		<Accordion type="single" collapsible defaultValue="subtasks">
			<AccordionItem value="subtasks" className="border-none">
				<AccordionTrigger className="hover:no-underline px-0">
					<div className="flex items-center gap-2">
						<Text size="xs" tone="muted" className="uppercase tracking-wide">
							Subtasks
						</Text>
						{subtasks.length > 0 && (
							<Text size="xs" tone="muted">
								{doneCount}/{subtasks.length} concluídas
							</Text>
						)}
					</div>
				</AccordionTrigger>
				<AccordionContent className="pt-2 pb-0">
					<div className="space-y-1">
						{subtasks.length === 0 ? (
							<div className="py-4 text-center border border-dashed border-border text-sm text-muted-foreground">
								Nenhuma subtask ainda
							</div>
						) : (
							subtasks.map((subtask) => (
								<SubtaskItemV1
									key={subtask.id}
									subtask={subtask}
									disabled={disabled || addMutation.isPending}
								/>
							))
						)}

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
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
