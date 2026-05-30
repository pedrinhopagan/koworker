import { useMemo } from "react";

import { Text } from "@/components/typography";
import { useAgendaStore } from "@/stores/agenda";
import { bucketEventsByDay } from "../-utils/event-day";
import { useMonthCalendar } from "../-utils/use-month-calendar";
import { useRangeEvents } from "../-utils/use-range-events";
import { AgendaNav } from "./agenda-nav";
import { EventDayCell } from "./event-day-cell";

export function MonthCalendar() {
	const {
		monthDays,
		weekdayLabels,
		startDate,
		endDate,
		monthLabel,
		goToPrev,
		goToNext,
		goToToday,
	} = useMonthCalendar();
	const { events } = useRangeEvents(startDate, endDate);
	const openCreate = useAgendaStore((s) => s.openCreate);
	const openEdit = useAgendaStore((s) => s.openEdit);

	const byDay = useMemo(
		() =>
			bucketEventsByDay(
				events,
				monthDays.map((day) => day.date),
			),
		[events, monthDays],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<AgendaNav label={monthLabel} onPrev={goToPrev} onNext={goToNext} onToday={goToToday} />
			<div className="grid grid-cols-7">
				{weekdayLabels.map((label) => (
					<Text
						key={label}
						as="span"
						size="xs"
						tone="muted"
						className="px-1.5 pb-1 text-center uppercase tracking-wide"
					>
						{label}
					</Text>
				))}
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px">
				{monthDays.map((day) => (
					<EventDayCell
						key={day.date}
						date={day.date}
						dayNumber={day.dayNumber}
						events={byDay.get(day.date) ?? []}
						maxVisible={2}
						isToday={day.isToday}
						isPast={day.isPast}
						muted={!day.isCurrentMonth}
						className="min-h-[88px]"
						onCreate={() => openCreate(day.date)}
						onEventClick={openEdit}
					/>
				))}
			</div>
		</div>
	);
}
