import { useDroppable } from "@dnd-kit/core";

import { Text } from "@/components/typography";
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
	const doneCount = tasks.filter((task) => task.status === "executed").length;
	const pendingCount = tasks.length - doneCount;
	const pastLabel = `(${doneCount}/${tasks.length})`;

	function handleClick() {
		openDrawer(day.date);
		onDayClick(day.date);
	}

	return (
		<div
			ref={setNodeRef}
			onPointerUp={handleClick}
			className={cn(
				"flex min-h-[200px] cursor-pointer flex-col border-r border-border transition-colors hover:bg-secondary/35 last:border-r-0",
				isOver && "bg-primary/10",
				isSelected && "bg-primary/5",
				day.isToday && "ring-1 ring-primary/45 ring-inset",
			)}
		>
			<div
				className={cn(
					"flex flex-col items-center border-b border-border px-2 py-3 transition-colors",
					day.isToday && "bg-primary/10",
					day.isPast && !day.isToday && "opacity-60",
				)}
			>
				<span
					className={cn(
						"text-xs font-medium uppercase text-muted-foreground",
						day.isToday && "text-primary",
					)}
				>
					{day.shortDayName}
				</span>
				<span
					className={cn(
						"mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold",
						day.isToday && "bg-primary text-primary-foreground",
						!day.isToday && "text-foreground",
					)}
				>
					{day.dayNumber}
				</span>
				<Text
					as="span"
					size="xs"
					tone="muted"
					className={cn("mt-1", day.isPast && pendingCount > 0 && "text-destructive")}
				>
					{pastLabel}
				</Text>
			</div>

			<div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
				{visibleTasks.map((task) => (
					<WeekTaskChip key={task.id} task={task} compact={tasks.length > 3} />
				))}

				{overflowCount > 0 && (
					<span className="mt-1 text-center text-xs text-muted-foreground">
						+{overflowCount} mais
					</span>
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
