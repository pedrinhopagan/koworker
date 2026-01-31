import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import type { TaskWithMeta } from "@/types/tasks";
import { useWeekCalendar } from "./use-week-calendar";
import { useWeekTasks } from "./use-week-tasks";
import { WeekDay } from "./WeekDay";
import { WeekTaskChip } from "./WeekTaskChip";

export type WeekCalendarRef = {
	refresh: () => void;
};

type WeekCalendarProps = {
	onTasksChanged?: () => void;
};

export const WeekCalendar = forwardRef<WeekCalendarRef, WeekCalendarProps>(function WeekCalendar(
	{ onTasksChanged },
	ref,
) {
	const queryClient = useQueryClient();
	const [activeTask, setActiveTask] = useState<TaskWithMeta | null>(null);

	const {
		weekDays,
		weekRangeLabel,
		startDate,
		endDate,
		goToPreviousWeek,
		goToNextWeek,
		goToToday,
	} = useWeekCalendar();

	const { tasksByDate, loading, refetch } = useWeekTasks(startDate, endDate);

	const sensors = useSensors(
		useSensor(MouseSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(TouchSensor, {
			activationConstraint: {
				delay: 200,
				tolerance: 5,
			},
		}),
	);

	const updateTaskMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
			onTasksChanged?.();
		},
	});

	function handleDragStart(event: DragStartEvent) {
		const { active } = event;
		const task = active.data.current?.task as TaskWithMeta | undefined;
		if (task) {
			setActiveTask(task);
		}
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveTask(null);

		if (!over) return;

		const task = active.data.current?.task as TaskWithMeta | undefined;
		const targetDate = over.data.current?.date as string | undefined;

		if (!task || !targetDate) return;
		if (task.scheduledDate === targetDate) return;

		updateTaskMutation.mutate(
			{ id: task.id, scheduledDate: targetDate },
			{
				onError: (e) => console.error("Failed to reschedule task:", e),
			},
		);
	}

	function handleDayClick(_date: string) {
		// Day click is handled by WeekDay component via openDrawer
	}

	useImperativeHandle(ref, () => ({
		refresh: () => refetch(),
	}));

	return (
		<div className="flex h-full flex-col">
			{/* Header with Navigation */}
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" onClick={goToPreviousWeek} className="h-8 w-8">
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<h2 className="min-w-[180px] text-center text-lg font-medium text-foreground">
						{weekRangeLabel}
					</h2>
					<Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-8 w-8">
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
				<Button variant="outline" size="sm" onClick={goToToday}>
					Hoje
				</Button>
			</div>

			{/* Week Grid */}
			<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
				<div className="relative flex flex-1 overflow-hidden">
					{loading ? (
						<div className="flex flex-1 items-center justify-center">
							<span className="text-sm text-muted-foreground">Carregando...</span>
						</div>
					) : (
						<div className="grid flex-1 grid-cols-7">
							{weekDays.map((day) => (
								<WeekDay
									key={day.date}
									day={day}
									tasks={tasksByDate.get(day.date) ?? []}
									onDayClick={handleDayClick}
								/>
							))}
						</div>
					)}
				</div>

				{/* Drag Overlay */}
				<DragOverlay>
					{activeTask && (
						<div className="rounded bg-background p-1 shadow-lg">
							<WeekTaskChip task={activeTask} />
						</div>
					)}
				</DragOverlay>
			</DndContext>
		</div>
	);
});
