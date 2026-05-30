import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
	"Jan",
	"Fev",
	"Mar",
	"Abr",
	"Mai",
	"Jun",
	"Jul",
	"Ago",
	"Set",
	"Out",
	"Nov",
	"Dez",
];

const DATE_FORMAT = "YYYY-MM-DD";

function weekStartOf(date: dayjs.Dayjs) {
	const start = date.startOf("day");

	return start.subtract(start.day(), "day");
}

export function useWeekCalendar() {
	const [weekStart, setWeekStart] = useState(() => weekStartOf(dayjs()));

	const goToPrev = useCallback(() => {
		setWeekStart((current) => current.subtract(7, "day"));
	}, []);

	const goToNext = useCallback(() => {
		setWeekStart((current) => current.add(7, "day"));
	}, []);

	const goToToday = useCallback(() => {
		setWeekStart(weekStartOf(dayjs()));
	}, []);

	return useMemo(() => {
		const today = dayjs().format(DATE_FORMAT);
		const weekEnd = weekStart.add(6, "day");

		const weekDays = Array.from({ length: 7 }, (_, index) => {
			const day = weekStart.add(index, "day");
			const date = day.format(DATE_FORMAT);

			return {
				date,
				dayNumber: day.date(),
				dayName: DAY_NAMES[index],
				isToday: date === today,
				isPast: date < today,
			};
		});

		const startMonth = MONTH_NAMES[weekStart.month()];
		const endMonth = MONTH_NAMES[weekEnd.month()];

		const rangeLabel =
			weekStart.month() === weekEnd.month()
				? `${weekStart.date()}-${weekEnd.date()} ${startMonth}`
				: `${weekStart.date()} ${startMonth} - ${weekEnd.date()} ${endMonth}`;

		return {
			weekDays,
			startDate: weekStart.format(DATE_FORMAT),
			endDate: weekEnd.format(DATE_FORMAT),
			rangeLabel,
			goToPrev,
			goToNext,
			goToToday,
		};
	}, [weekStart, goToPrev, goToNext, goToToday]);
}
