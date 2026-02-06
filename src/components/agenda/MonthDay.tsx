import { useDroppable } from "@dnd-kit/core";

import { Text, Title } from "@/components/typography";
import { cn } from "@/lib/utils";
import { useAgendaStore } from "@/stores/agenda";
import type { TaskWithMeta } from "@/types/tasks";
import type { MonthDayData } from "./use-month-calendar";
import { WeekTaskChip } from "./WeekTaskChip";

type MonthDayProps = {
	day: MonthDayData;
	tasks: TaskWithMeta[];
	isLastColumn?: boolean;
};

export function MonthDay({ day, tasks, isLastColumn = false }: MonthDayProps) {
	const openDrawer = useAgendaStore((state) => state.openDrawer);
	const selectedDate = useAgendaStore((state) => state.selectedDate);

	const { isOver, setNodeRef } = useDroppable({
		id: `month-day-${day.date}`,
		data: {
			date: day.date,
			type: "day",
		},
	});

	const visibleTasks = tasks.slice(0, 2);
	const overflowCount = Math.max(0, tasks.length - visibleTasks.length);
	const doneCount = tasks.filter((task) => task.status === "executed").length;
	const pendingCount = tasks.length - doneCount;
	const pastLabel = `(${doneCount}/${tasks.length})`;

	return (
		<div
			ref={setNodeRef}
			onPointerUp={() => openDrawer(day.date)}
			className={cn(
				"min-h-[132px] cursor-pointer border-b border-border bg-background px-2 py-2 transition-colors hover:bg-secondary/35",
				!isLastColumn && "border-r",
				!day.isCurrentMonth && "bg-muted/25",
				day.isPast && !day.isToday && "opacity-70",
				day.isToday && "bg-primary/8 ring-1 ring-primary/45 ring-inset",
				selectedDate === day.date && "ring-1 ring-primary/40",
				isOver && "bg-primary/12",
			)}
		>
			<div className="mb-2 flex w-full flex-col items-start gap-1 rounded-sm px-1 py-1 text-left">
				<div className="flex w-full items-center justify-between">
					<Title
						as="span"
						size="xs"
						className={cn(
							"font-semibold",
							day.isToday ? "text-primary" : "text-foreground",
							!day.isCurrentMonth && "text-muted-foreground",
						)}
					>
						{day.dayNumber}
					</Title>
					{day.isToday && (
						<Text
							as="span"
							size="xs"
							tone="muted"
							className="rounded bg-primary/15 px-1.5 py-0.5 text-primary"
						>
							hoje
						</Text>
					)}
				</div>
				<Text
					as="span"
					size="xs"
					tone="muted"
					className={cn(day.isPast && pendingCount > 0 && "text-destructive")}
				>
					{pastLabel}
				</Text>
			</div>

			<div className="space-y-1">
				{visibleTasks.map((task) => (
					<WeekTaskChip key={task.id} task={task} compact />
				))}
				{overflowCount > 0 && (
					<span className="w-full rounded-sm px-1 py-1 text-left text-xs text-muted-foreground">
						+{overflowCount} tarefas
					</span>
				)}
			</div>
		</div>
	);
}
