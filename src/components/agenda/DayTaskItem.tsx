import { useDraggable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { TaskItem } from "@/components/tasks";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

type DayTaskItemProps = {
	task: TaskWithMeta;
	scheduledDate?: string | null;
	onStatusChange?: () => void;
};

export function DayTaskItem({ task, scheduledDate = null, onStatusChange }: DayTaskItemProps) {
	const queryClient = useQueryClient();
	const isDone = task.status === "executed";

	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: `day-task-${task.id}`,
		data: {
			task,
			type: "task",
			fromDate: scheduledDate,
		},
	});

	const style = transform
		? {
				transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
			}
		: undefined;

	const updateStatusMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
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

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...listeners}
			{...attributes}
			role="document"
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					toggleStatus();
				}
			}}
			className={cn(
				"cursor-grab transition-opacity",
				isDragging && "z-50 cursor-grabbing opacity-50",
			)}
		>
			<TaskItem task={task} variant="compact" />
		</div>
	);
}
