import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import {
	DragHandle,
	type SortableItemRenderProps,
	SortableList,
} from "@/components/ui/sortable-list";
import { type Subtask, useSubtasks } from "@/hooks/use-subtasks";
import { cn } from "@/lib/utils";
import { SubtaskItem } from "./SubtaskItem";

// ============================================================================
// Styles
// ============================================================================

const subtaskListVariants = tv({
	slots: {
		root: "",
		header: "mb-2 flex items-center justify-between",
		label: "text-xs uppercase tracking-wide text-muted-foreground",
		counter: "text-xs text-muted-foreground",
		list: "mb-3",
		emptyState:
			"mb-3 border border-dashed border-border bg-background py-4 text-center text-sm text-muted-foreground",
		addRow: "flex items-center gap-2",
		addIcon: "text-muted-foreground",
		addInput:
			"flex-1 border-b border-transparent bg-transparent text-sm text-foreground transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
		addButton:
			"px-3 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
		itemWrapper: "flex items-start gap-1",
		dragHandleWrapper: "flex items-center pt-2",
		itemContent: "flex-1",
	},
	variants: {
		disabled: {
			true: {
				root: "pointer-events-none opacity-50",
			},
		},
	},
	defaultVariants: {
		disabled: false,
	},
});

export type SubtaskListVariants = VariantProps<typeof subtaskListVariants>;

// ============================================================================
// Types
// ============================================================================

type SubtaskListProps = {
	taskId: string;
	disabled?: boolean;
	className?: string;
};

// ============================================================================
// Component
// ============================================================================

export function SubtaskList({ taskId, disabled = false, className }: SubtaskListProps) {
	const [newTitle, setNewTitle] = useState("");

	const { subtasks, isLoading, add, reorder } = useSubtasks(taskId);

	const styles = subtaskListVariants({ disabled: disabled || isLoading });

	const sortedSubtasks = useMemo(
		() => [...subtasks].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[subtasks],
	);

	// Count completed subtasks
	const doneCount = subtasks.filter((s) => s.status === "executed").length;

	// Handle adding a new subtask
	function handleAdd() {
		if (!newTitle.trim()) return;
		add(newTitle.trim());
		setNewTitle("");
	}

	// Handle keyboard submission
	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			handleAdd();
		}
	}

	// Handle reorder from SortableList
	function handleReorder(newItems: Subtask[]) {
		reorder(newItems);
	}

	// Render a single sortable item
	function renderItem(subtask: Subtask, props: SortableItemRenderProps) {
		return (
			<div className={styles.itemWrapper()} style={props.style}>
				{/* Drag handle */}
				<div className={styles.dragHandleWrapper()}>
					<DragHandle
						attributes={props.dragHandleProps.attributes}
						listeners={props.dragHandleProps.listeners}
						disabled={disabled}
					/>
				</div>

				{/* Subtask item */}
				<div className={styles.itemContent()}>
					<SubtaskItem subtask={subtask} taskId={taskId} disabled={disabled} />
				</div>
			</div>
		);
	}

	// Render drag overlay (ghost element during drag)
	function renderDragOverlay(subtask: Subtask) {
		return (
			<div className="rounded bg-card p-2 shadow-lg">
				<span className="text-sm">{subtask.title}</span>
			</div>
		);
	}

	return (
		<section className={cn(styles.root(), className)}>
			{/* Header */}
			<div className={styles.header()}>
				<span className={styles.label()}>Subtasks</span>
				{subtasks.length > 0 && (
					<span className={styles.counter()}>
						{doneCount}/{subtasks.length} concluídas
					</span>
				)}
			</div>

			{/* List */}
			{sortedSubtasks.length > 0 ? (
				<div className={styles.list()}>
					<SortableList
						items={sortedSubtasks}
						onReorder={handleReorder}
						renderItem={renderItem}
						renderDragOverlay={renderDragOverlay}
						disabled={disabled}
					/>
				</div>
			) : (
				<div className={styles.emptyState()}>Nenhuma subtask ainda</div>
			)}

			{/* Add new subtask */}
			<div className={styles.addRow()}>
				<Plus className={cn(styles.addIcon(), "size-4")} />
				<input
					type="text"
					value={newTitle}
					onChange={(e) => setNewTitle(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Adicionar subtask..."
					disabled={disabled || isLoading}
					className={styles.addInput()}
				/>
				<button
					type="button"
					onClick={handleAdd}
					disabled={!newTitle.trim() || disabled || isLoading}
					className={styles.addButton()}
				>
					Adicionar
				</button>
			</div>
		</section>
	);
}
