import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/client";
import { TaskItem } from "@/components/tasks";
import { cn } from "@/lib/utils";
import { useAgendaStore } from "@/stores/agenda";
import type { TaskWithMeta } from "@/types/tasks";

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

	const updateStatusMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			// ORPC query keys are nested; invalidate all tasks queries.
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
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
			className={cn(isDragging && "cursor-grabbing opacity-50")}
		>
			<TaskItem task={task} variant="compact" />
		</div>
	);
}
