import { useDraggable } from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { TaskItem } from "@/components/tasks";
import { Text } from "@/components/typography";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";
import { buildTimeSlots } from "../-utils/time-slots";

type DayTaskItemProps = {
	task: TaskWithMeta;
	scheduledDate?: string | null;
	onStatusChange?: () => void;
};

export function DayTaskItem({ task, scheduledDate = null, onStatusChange }: DayTaskItemProps) {
	const queryClient = useQueryClient();
	const scheduledTime = task.scheduledTime ?? "00:00";
	const slots = buildTimeSlots();

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

	const updateTaskMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
			onStatusChange?.();
		},
	});

	function handleTimeChange(nextTime: string) {
		updateTaskMutation.mutate(
			{
				id: task.id,
				scheduledDate: scheduledDate ?? task.scheduledDate ?? null,
				scheduledTime: nextTime,
			},
			{ onError: (e) => console.error("Failed to update task schedule:", e) },
		);
	}

	return (
		<div className="border-b border-border/70 px-2 pt-2 pb-1">
			<div
				ref={setNodeRef}
				style={style}
				{...listeners}
				{...attributes}
				className={cn(
					"cursor-grab transition-opacity",
					isDragging && "z-50 cursor-grabbing opacity-50",
				)}
			>
				<TaskItem task={task} variant="agendaBacklog" />
			</div>
			<div className="flex items-center justify-between gap-3 px-3 py-2">
				<Text as="span" size="xs" tone="muted">
					Horario
				</Text>
				<select
					value={scheduledTime}
					onChange={(event) => handleTimeChange(event.target.value)}
					onPointerDown={(event) => event.stopPropagation()}
					onMouseDown={(event) => event.stopPropagation()}
					className="h-8 rounded-md border border-input bg-background px-2 text-xs"
					disabled={updateTaskMutation.isPending}
				>
					{slots.map((slot) => (
						<option key={slot} value={slot}>
							{slot}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
