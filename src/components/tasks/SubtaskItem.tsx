import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { orpc } from "@/client";
import { CompletionToggle } from "@/components/tasks/CompletionToggle";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import type { Subtask } from "@/hooks/use-subtasks";
import { cn } from "@/lib/utils";

const subtaskItemVariants = tv({
	slots: {
		root: "group animate-fade-in",
		container: "flex items-center gap-3 bg-card px-3 py-2 transition-colors hover:bg-popover",
		checkbox: "transition-colors",
		expandButton: "text-muted-foreground transition-colors hover:text-primary",
		title: "flex-1 text-sm text-foreground",
		detailsHint: "text-xs text-muted-foreground",
		removeButton: "opacity-0 transition-all group-hover:opacity-100",
		expandedContent:
			"ml-6 animate-slide-down space-y-4 border-l-2 border-border bg-background px-3 py-3",
		label: "text-xs uppercase tracking-wide text-muted-foreground",
		textarea:
			"w-full resize-none border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
	},
	variants: {
		isDone: {
			true: {
				root: "opacity-50",
				checkbox: "text-primary",
				title: "line-through",
			},
			false: {
				checkbox: "text-muted-foreground hover:text-primary",
			},
		},
		disabled: {
			true: {
				root: "pointer-events-none opacity-50",
				checkbox: "cursor-not-allowed",
				expandButton: "cursor-not-allowed",
				removeButton: "hidden cursor-not-allowed",
			},
		},
		expanded: {
			true: {},
		},
	},
	defaultVariants: {
		isDone: false,
		disabled: false,
		expanded: false,
	},
});

export type SubtaskItemVariants = VariantProps<typeof subtaskItemVariants>;

type SubtaskItemProps = {
	subtask: Subtask;
	taskId: string;
	disabled?: boolean;
	className?: string;
};

export function SubtaskItem({ subtask, taskId, disabled = false, className }: SubtaskItemProps) {
	const queryClient = useQueryClient();
	const [expanded, setExpanded] = useState(false);
	const [description, setDescription] = useState(subtask.description || "");

	useEffect(() => {
		setDescription(subtask.description || "");
	}, [subtask.description]);

	const queryKey = orpc.subtasks.listByTask.queryOptions({ input: { taskId } }).queryKey;

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey });
	};

	const updateMutation = useMutation({
		...orpc.subtasks.update.mutationOptions(),
		onSuccess: invalidate,
	});

	const removeMutation = useMutation({
		...orpc.subtasks.remove.mutationOptions(),
		onSuccess: invalidate,
	});

	const isDone = subtask.status === "executed";
	const hasDetails = Boolean(subtask.description);
	const isMutating = updateMutation.isPending || removeMutation.isPending;

	const styles = subtaskItemVariants({ isDone, disabled: disabled || isMutating, expanded });

	function handleToggle() {
		const newStatus = isDone ? "pending" : "executed";
		const completedAt = newStatus === "executed" ? Date.now() : null;
		updateMutation.mutate({ id: subtask.id, status: newStatus, completedAt });
	}

	function handleRemove() {
		removeMutation.mutate({ id: subtask.id });
	}

	function handleDescriptionBlur() {
		const newDesc = description || undefined;
		if (newDesc !== (subtask.description || undefined)) {
			updateMutation.mutate({ id: subtask.id, description: newDesc });
		}
	}

	function toggleExpand() {
		setExpanded((prev) => !prev);
	}

	return (
		<div className={cn(styles.root(), className)}>
			<div className={styles.container()}>
				{/* Checkbox */}
				<CompletionToggle
					checked={isDone}
					onCheckedChange={handleToggle}
					disabled={disabled || isMutating}
					aria-label={isDone ? "Marcar como pendente" : "Marcar como concluída"}
				/>

				{/* Expand button */}
				<button
					type="button"
					onClick={toggleExpand}
					disabled={disabled}
					className={styles.expandButton()}
					title={expanded ? "Recolher detalhes" : "Expandir detalhes"}
				>
					<ChevronRight size={14} className={cn("transition-transform", expanded && "rotate-90")} />
				</button>

				{/* Title */}
				<span className={styles.title()}>{subtask.title}</span>

				{/* Details hint when collapsed */}
				{!expanded && hasDetails && <span className={styles.detailsHint()}>(detalhes)</span>}

				{/* Remove button */}
				<DeleteConfirmButton
					onDelete={handleRemove}
					disabled={disabled || isMutating}
					size="icon-sm"
					className={styles.removeButton()}
					title="Remover subtask"
					confirmTitle="Confirmar remoção da subtask"
				/>
			</div>

			{/* Expanded content */}
			{expanded && (
				<div className={styles.expandedContent()}>
					<div className="space-y-1">
						<div className={styles.label()}>Descrição</div>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
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
