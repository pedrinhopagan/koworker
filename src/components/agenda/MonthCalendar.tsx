import { ChevronLeft, ChevronRight } from "lucide-react";
import { forwardRef, useImperativeHandle } from "react";

import { Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { MonthDay } from "./MonthDay";
import { useMonthCalendar } from "./use-month-calendar";
import { useWeekTasks } from "./use-week-tasks";

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export type MonthCalendarRef = {
	refresh: () => void;
};

export const MonthCalendar = forwardRef<MonthCalendarRef, object>(
	function MonthCalendar(_props, ref) {
		const {
			monthDays,
			monthLabel,
			startDate,
			endDate,
			goToPreviousMonth,
			goToNextMonth,
			goToToday,
		} = useMonthCalendar();

		const { tasksByDate, loading, refetch } = useWeekTasks(startDate, endDate);

		useImperativeHandle(ref, () => ({
			refresh: () => refetch(),
		}));

		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="h-8 w-8">
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Title as="h2" size="lg" className="min-w-45 text-center font-medium">
							{monthLabel}
						</Title>
						<Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
					<Button variant="outline" size="sm" onClick={goToToday}>
						Hoje
					</Button>
				</div>

				{loading && (
					<div className="flex flex-1 items-center justify-center">
						<span className="text-sm text-muted-foreground">Carregando...</span>
					</div>
				)}

				{!loading && (
					<div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] overflow-y-auto">
						{dayNames.map((dayName) => (
							<div
								key={dayName}
								className="sticky top-0 z-10 border-r border-b border-border bg-card px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground last:border-r-0"
							>
								{dayName}
							</div>
						))}
						{monthDays.map((day, index) => (
							<MonthDay
								key={day.date}
								day={day}
								tasks={tasksByDate.get(day.date) ?? []}
								isLastColumn={index % 7 === 6}
							/>
						))}
					</div>
				)}
			</div>
		);
	},
);
