import { useCallback, useMemo, useState } from "react";
import dayjs from "dayjs";

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const monthNames = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro",
];

export function useMonthCalendar() {
	const [currentMonth, setCurrentMonth] = useState(() => dayjs().startOf("month"));

	const goToPrev = useCallback(() => {
		setCurrentMonth((month) => month.subtract(1, "month"));
	}, []);

	const goToNext = useCallback(() => {
		setCurrentMonth((month) => month.add(1, "month"));
	}, []);

	const goToToday = useCallback(() => {
		setCurrentMonth(dayjs().startOf("month"));
	}, []);

	return useMemo(() => {
		const today = dayjs().format("YYYY-MM-DD");
		const gridStart = currentMonth.subtract(currentMonth.day(), "day");

		const monthDays = Array.from({ length: 42 }, (_, index) => {
			const cell = gridStart.add(index, "day");
			const date = cell.format("YYYY-MM-DD");

			return {
				date,
				dayNumber: cell.date(),
				isToday: date === today,
				isCurrentMonth: cell.month() === currentMonth.month(),
				isPast: date < today,
			};
		});

		return {
			monthDays,
			weekdayLabels,
			startDate: monthDays[0].date,
			endDate: monthDays[41].date,
			monthLabel: `${monthNames[currentMonth.month()]} ${currentMonth.year()}`,
			goToPrev,
			goToNext,
			goToToday,
		};
	}, [currentMonth, goToPrev, goToNext, goToToday]);
}
