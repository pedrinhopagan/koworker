import { ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { tv } from "tailwind-variants";

import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { SubtaskFull } from "@/types/tasks";

import { useSubtaskItemMutations } from "../-utils/use-subtask-item-mutations";

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

type SubtaskItemProps = {
	subtask: SubtaskFull;
	disabled?: boolean;
	selectionMode?: boolean;
	isSelected?: boolean;
	onToggleSelection?: (id: string) => void;
};

export function SubtaskItem({
	subtask,
	disabled,
	selectionMode,
	isSelected,
	onToggleSelection,
}: SubtaskItemProps) {
	const [expanded, setExpanded] = useState(false);
	const [localDescription, setLocalDescription] = useState(subtask.description ?? "");
	const { updateMutation, removeMutation, isMutating } = useSubtaskItemMutations();

	const isDone = subtask.status === "executed";
	const hasDetails = Boolean(subtask.description);
	const styles = subtaskItemVariants({
		done: isDone,
		selectionMode,
		selected: isSelected,
	});

	function handleToggle(event: React.MouseEvent) {
		event.stopPropagation();
		const newStatus = isDone ? "pending" : "executed";
		const completedAt = newStatus === "executed" ? Date.now() : null;
		updateMutation.mutate({ id: subtask.id, status: newStatus, completedAt });
	}

	function handleRemove(event: React.MouseEvent) {
		event.stopPropagation();
		removeMutation.mutate({ id: subtask.id });
	}

	function handleDescriptionBlur() {
		const newDescription = localDescription || undefined;
		if (newDescription !== (subtask.description ?? undefined)) {
			updateMutation.mutate({ id: subtask.id, description: newDescription });
		}
	}

	function handleSelectionChange() {
		if (onToggleSelection && !disabled) {
			onToggleSelection(subtask.id);
		}
	}

	function handleToggleDetails(event: React.MouseEvent) {
		event.stopPropagation();
		if (disabled) {
			return;
		}
		setExpanded(!expanded);
	}

	return (
		<div className={styles.root()}>
			<div className={cn(styles.row(), expanded ? "border-border" : "border-transparent")}>
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
							onClick={(event) => event.stopPropagation()}
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
								onChange={(event) => setLocalDescription(event.target.value)}
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

export function ParentTaskSelectionRow({
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
		if (!isSelectable) {
			return;
		}
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
