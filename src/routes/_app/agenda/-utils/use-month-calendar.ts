import { useCallback, useMemo, useState } from "react";

export type MonthDayData = {
	date: string;
	dayNumber: number;
	isToday: boolean;
	isCurrentMonth: boolean;
	isPast: boolean;
};

export type UseMonthCalendarReturn = {
	monthDays: MonthDayData[];
	monthLabel: string;
	startDate: string;
	endDate: string;
	goToPreviousMonth: () => void;
	goToNextMonth: () => void;
	goToToday: () => void;
};

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

function formatDate(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function getCalendarGridStart(currentMonth: Date) {
	const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
	const offset = firstDay.getDay();
	firstDay.setDate(firstDay.getDate() - offset);
	firstDay.setHours(0, 0, 0, 0);
	return firstDay;
}

export function useMonthCalendar(): UseMonthCalendarReturn {
	const [currentMonth, setCurrentMonth] = useState(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1);
	});

	const monthLabel = useMemo(
		() => `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`,
		[currentMonth],
	);

	const monthDays = useMemo(() => {
		const today = new Date();
		const todayLabel = formatDate(today);
		const start = getCalendarGridStart(currentMonth);

		return Array.from({ length: 42 }, (_, index) => {
			const date = new Date(start);
			date.setDate(start.getDate() + index);

			const dateLabel = formatDate(date);

			return {
				date: dateLabel,
				dayNumber: date.getDate(),
				isToday: dateLabel === todayLabel,
				isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
				isPast: dateLabel < todayLabel,
			};
		});
	}, [currentMonth]);

	const startDate = monthDays[0]?.date ?? formatDate(currentMonth);
	const endDate = monthDays[41]?.date ?? formatDate(currentMonth);

	const goToPreviousMonth = useCallback(() => {
		setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1));
	}, []);

	const goToNextMonth = useCallback(() => {
		setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1));
	}, []);

	const goToToday = useCallback(() => {
		const now = new Date();
		setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
	}, []);

	return {
		monthDays,
		monthLabel,
		startDate,
		endDate,
		goToPreviousMonth,
		goToNextMonth,
		goToToday,
	};
}
