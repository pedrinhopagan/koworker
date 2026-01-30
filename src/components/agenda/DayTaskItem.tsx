import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAgendaStore } from "@/stores/agenda";
import type { TaskWithMeta } from "@/types/tasks";

const statusVariants = {
	pending: "muted",
	in_execution: "warning",
	executed: "success",
} as const;

type DayTaskItemProps = {
	task: TaskWithMeta;
	scheduledDate?: string | null;
	onStatusChange?: () => void;
};

export function DayTaskItem({ task, scheduledDate = null, onStatusChange }: DayTaskItemProps) {
	const queryClient = useQueryClient();
	const setDraggedTask = useAgendaStore((s) => s.setDraggedTask);
	const setDrawerCollapsed = useAgendaStore((s) => s.setDrawerCollapsed);
	const [isDragging, setIsDragging] = useState(false);

	const isDone = task.status === "executed";
	const statusVariant = statusVariants[task.status] ?? "muted";

	const updateStatusMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			onStatusChange?.();
		},
	});

	function toggleStatus() {
		const newStatus = isDone ? "pending" : "executed";
		updateStatusMutation.mutate(
			{ id: task.id, status: newStatus as "pending" | "in_execution" | "executed" },
			{ onError: (e) => console.error("Failed to update task status:", e) },
		);
	}

	function handleDragStart(e: React.DragEvent) {
		setIsDragging(true);
		setDrawerCollapsed(true);
		setDraggedTask({
			id: task.id,
			title: task.title,
			fromDate: scheduledDate,
		});
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", task.id);
		}
	}

	function handleDragEnd() {
		setIsDragging(false);
		setDrawerCollapsed(false);
		setDraggedTask(null);
	}

	return (
		<div
			role="document"
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					toggleStatus();
				}
			}}
			draggable
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			className={cn(
				"flex cursor-grab items-center justify-between gap-4 border border-transparent bg-card px-3 py-1.5 transition-colors duration-200 hover:border-border hover:bg-secondary/30",
				isDragging && "cursor-grabbing opacity-50",
			)}
		>
			<div className="flex min-w-0 items-center gap-3">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						toggleStatus();
					}}
					className={cn(
						"shrink-0 transition-colors hover:text-primary",
						isDone ? "text-primary" : "text-muted-foreground",
					)}
				>
					{isDone ? "[x]" : "[ ]"}
				</button>
				<Title
					as="span"
					size="sm"
					className={cn(
						"truncate text-sm font-normal",
						isDone && "text-muted-foreground line-through",
					)}
				>
					{task.title}
				</Title>
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<Badge variant={statusVariant} className="shrink-0">
					{task.statusLabel}
				</Badge>
				<Badge
					variant="muted"
					className="shrink-0"
					style={{
						backgroundColor: `${task.category.color}20`,
						color: task.category.color,
					}}
				>
					{task.category.name}
				</Badge>
				<Badge
					variant="muted"
					className="shrink-0"
					style={{
						backgroundColor: `${task.priority.color}20`,
						color: task.priority.color,
					}}
				>
					{task.priority.name}
				</Badge>
			</div>
		</div>
	);
}
