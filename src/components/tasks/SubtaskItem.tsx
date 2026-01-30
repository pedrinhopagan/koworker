import { useState, useEffect } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { orpc } from "@/client";
import type { Subtask } from "@/hooks/use-subtasks";

const subtaskItemVariants = tv({
	slots: {
		root: "group animate-fade-in",
		container: "flex items-center gap-3 bg-card px-3 py-2 transition-colors hover:bg-popover",
		checkbox: "transition-colors",
		expandButton: "text-muted-foreground transition-colors hover:text-primary",
		title: "flex-1 text-sm text-foreground",
		detailsHint: "text-xs text-muted-foreground",
		removeButton:
			"p-1 text-destructive opacity-0 transition-all hover:text-destructive/80 group-hover:opacity-100",
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
				<button
					type="button"
					onClick={handleToggle}
					disabled={disabled || isMutating}
					className={styles.checkbox()}
				>
					{isDone ? "[x]" : "[ ]"}
				</button>

				{/* Expand button */}
				<button
					type="button"
					onClick={toggleExpand}
					disabled={disabled}
					className={styles.expandButton()}
					title={expanded ? "Recolher detalhes" : "Expandir detalhes"}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className={cn("transition-transform", expanded && "rotate-90")}
					>
						<path d="m9 18 6-6-6-6" />
					</svg>
				</button>

				{/* Title */}
				<span className={styles.title()}>{subtask.title}</span>

				{/* Details hint when collapsed */}
				{!expanded && hasDetails && <span className={styles.detailsHint()}>(detalhes)</span>}

				{/* Remove button */}
				<button
					type="button"
					onClick={handleRemove}
					disabled={disabled || isMutating}
					className={styles.removeButton()}
					title="Remover subtask"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			</div>

			{/* Expanded content */}
			{expanded && (
				<div className={styles.expandedContent()}>
					<div className="space-y-1">
						<label className={styles.label()}>Descrição</label>
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
