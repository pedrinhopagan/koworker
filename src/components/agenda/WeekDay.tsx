import { useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import { useAgendaStore } from "@/stores/agenda";
import type { TaskWithMeta } from "@/types/tasks";
import type { WeekDayData } from "./use-week-calendar";
import { WeekTaskChip } from "./WeekTaskChip";

type WeekDayProps = {
	day: WeekDayData;
	tasks: TaskWithMeta[];
	onDayClick: (date: string) => void;
};

export function WeekDay({ day, tasks, onDayClick }: WeekDayProps) {
	const openDrawer = useAgendaStore((s) => s.openDrawer);
	const selectedDate = useAgendaStore((s) => s.selectedDate);

	const { isOver, setNodeRef } = useDroppable({
		id: `day-${day.date}`,
		data: {
			date: day.date,
			type: "day",
		},
	});

	const isSelected = selectedDate === day.date;
	const visibleTasks = tasks.slice(0, 5);
	const overflowCount = Math.max(0, tasks.length - 5);

	function handleClick() {
		openDrawer(day.date);
		onDayClick(day.date);
	}

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex min-h-[200px] flex-col border-r border-border transition-colors last:border-r-0",
				isOver && "bg-primary/10",
				isSelected && "bg-primary/5"
			)}
		>
			{/* Day Header */}
			<button
				type="button"
				onClick={handleClick}
				className={cn(
					"flex flex-col items-center border-b border-border px-2 py-3 transition-colors hover:bg-secondary/50",
					day.isToday && "bg-primary/10",
					day.isPast && !day.isToday && "opacity-60"
				)}
			>
				<span
					className={cn(
						"text-xs font-medium uppercase text-muted-foreground",
						day.isToday && "text-primary"
					)}
				>
					{day.shortDayName}
				</span>
				<span
					className={cn(
						"mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold",
						day.isToday && "bg-primary text-primary-foreground",
						!day.isToday && "text-foreground"
					)}
				>
					{day.dayNumber}
				</span>
			</button>

			{/* Tasks Container */}
			<div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
				{visibleTasks.map((task) => (
					<WeekTaskChip key={task.id} task={task} compact={tasks.length > 3} />
				))}

				{overflowCount > 0 && (
					<button
						type="button"
						onClick={handleClick}
						className="mt-1 text-center text-xs text-muted-foreground hover:text-foreground"
					>
						+{overflowCount} mais
					</button>
				)}

				{tasks.length === 0 && !isOver && (
					<div className="flex flex-1 items-center justify-center">
						<span className="text-xs text-muted-foreground/50">—</span>
					</div>
				)}

				{isOver && tasks.length === 0 && (
					<div className="flex flex-1 items-center justify-center rounded border-2 border-dashed border-primary/30 bg-primary/5">
						<span className="text-xs text-primary/70">Solte aqui</span>
					</div>
				)}
			</div>
		</div>
	);
}
