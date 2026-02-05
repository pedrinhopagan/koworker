import { ChevronLeft, ChevronRight } from "lucide-react";
import { forwardRef, useImperativeHandle } from "react";

import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useWeekCalendar } from "./use-week-calendar";
import { useWeekTasks } from "./use-week-tasks";
import { WeekDay } from "./WeekDay";

export type WeekCalendarRef = {
	refresh: () => void;
};

export const WeekCalendar = forwardRef<WeekCalendarRef, object>(function WeekCalendar(_props, ref) {
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
					<Title as="h2" size="lg" className="min-w-45 text-center font-medium">
						{weekRangeLabel}
					</Title>
					<Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-8 w-8">
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
				<Button variant="outline" size="sm" onClick={goToToday}>
					Hoje
				</Button>
			</div>

			{/* Week Grid */}
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
		</div>
	);
});
