import { useDraggable } from "@dnd-kit/core";

import { TaskItem } from "@/components/tasks";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

type AgendaSidebarTaskProps = {
	task: TaskWithMeta;
	showScheduledDate: boolean;
};

export function AgendaSidebarTask({ task, showScheduledDate }: AgendaSidebarTaskProps) {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: `agenda-sidebar-task-${task.id}`,
		data: {
			task,
			type: "task",
			fromDate: task.scheduledDate ?? null,
		},
	});

	const style =
		!isDragging && transform
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
			className={cn(
				"w-full max-w-full cursor-grab overflow-x-hidden",
				isDragging && "pointer-events-none cursor-grabbing opacity-0",
			)}
		>
			<TaskItem task={task} variant="agendaBacklog" showScheduledDate={showScheduledDate} />
		</div>
	);
}
