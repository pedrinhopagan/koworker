import { useDraggable } from "@dnd-kit/core";

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

	const isDone = task.status === "executed";
	const today = new Date().toISOString().split("T")[0];
	const isOverdue = task.scheduledDate && task.scheduledDate < today && task.status !== "executed";

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...listeners}
			{...attributes}
			className={cn(
				"cursor-grab rounded px-2 py-1 text-xs transition-all hover:opacity-80",
				isDragging && "z-50 cursor-grabbing opacity-60 shadow-lg",
				isDone && "line-through opacity-50",
			)}
			title={task.title}
		>
			<div
				className="flex items-center gap-1.5"
				style={{
					backgroundColor: isOverdue ? "hsl(var(--destructive) / 0.1)" : `${task.category.color}15`,
					borderLeftWidth: "3px",
					borderLeftStyle: "solid",
					borderLeftColor: isOverdue ? "hsl(var(--destructive))" : task.category.color,
					padding: "4px 8px",
					borderRadius: "4px",
				}}
			>
				{!compact && (
					<span className="max-w-[100px] truncate text-foreground">
						{task.title.length > 15 ? `${task.title.slice(0, 15)}...` : task.title}
					</span>
				)}
				{compact && (
					<span className="max-w-[60px] truncate text-foreground">
						{task.title.length > 8 ? `${task.title.slice(0, 8)}...` : task.title}
					</span>
				)}
				<span className="shrink-0 text-[10px] font-medium" style={{ color: task.priority.color }}>
					{task.priority.name?.charAt(0)}
				</span>
			</div>
		</div>
	);
}
