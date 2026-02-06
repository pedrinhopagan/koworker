import { useDraggable } from "@dnd-kit/core";

import { TaskItem } from "@/components/tasks";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

type WeekTaskChipProps = {
	task: TaskWithMeta;
	compact?: boolean;
};

export function WeekTaskChip({ task, compact = false }: WeekTaskChipProps) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: task.id,
		data: {
			task,
			type: "task",
			fromDate: task.scheduledDate,
		},
	});

	const style = transform
		? {
				transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
			}
		: undefined;

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...listeners}
			{...attributes}
			onPointerDown={(event) => event.stopPropagation()}
			onPointerUp={(event) => event.stopPropagation()}
			className={cn(
				"inline-flex w-full cursor-grab justify-center px-2 transition-all",
				compact && "px-2",
				isDragging && "z-50 cursor-grabbing opacity-60 shadow-lg",
			)}
			title={`${task.title} ${task.scheduledTime ?? "00:00"}`}
		>
			<TaskItem task={task} variant="agendaMini" />
		</div>
	);
}
