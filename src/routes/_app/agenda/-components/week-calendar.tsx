import { useMemo } from "react";

import { useAgendaStore } from "@/stores/agenda";
import { bucketEventsByDay } from "../-utils/event-day";
import { useRangeEvents } from "../-utils/use-range-events";
import { useWeekCalendar } from "../-utils/use-week-calendar";
import { AgendaNav } from "./agenda-nav";
import { EventDayCell } from "./event-day-cell";

export function WeekCalendar() {
	const { weekDays, startDate, endDate, rangeLabel, goToPrev, goToNext, goToToday } =
		useWeekCalendar();
	const { events } = useRangeEvents(startDate, endDate);
	const openCreate = useAgendaStore((s) => s.openCreate);
	const openEdit = useAgendaStore((s) => s.openEdit);

	const byDay = useMemo(
		() =>
			bucketEventsByDay(
				events,
				weekDays.map((day) => day.date),
			),
		[events, weekDays],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<AgendaNav label={rangeLabel} onPrev={goToPrev} onNext={goToNext} onToday={goToToday} />
			<div className="grid min-h-0 flex-1 grid-cols-7 gap-px">
				{weekDays.map((day) => (
					<EventDayCell
						key={day.date}
						date={day.date}
						dayNumber={day.dayNumber}
						dayName={day.dayName}
						events={byDay.get(day.date) ?? []}
						maxVisible={5}
						isToday={day.isToday}
						isPast={day.isPast}
						onCreate={() => openCreate(day.date)}
						onEventClick={openEdit}
					/>
				))}
			</div>
		</div>
	);
}
