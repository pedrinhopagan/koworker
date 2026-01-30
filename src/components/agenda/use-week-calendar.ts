import { useState, useCallback, useMemo } from "react";

export type WeekDayData = {
	date: string;
	dayNumber: number;
	dayName: string;
	shortDayName: string;
	monthName: string;
	isToday: boolean;
	isPast: boolean;
};

export type UseWeekCalendarReturn = {
	/** Current week start date (Sunday) */
	weekStart: Date;
	/** Array of 7 days in the current week */
	weekDays: WeekDayData[];
	/** Formatted week range string (e.g., "12-18 Jan 2025") */
	weekRangeLabel: string;
	/** Start date in YYYY-MM-DD format */
	startDate: string;
	/** End date in YYYY-MM-DD format */
	endDate: string;
	/** Navigate to previous week */
	goToPreviousWeek: () => void;
	/** Navigate to next week */
	goToNextWeek: () => void;
	/** Navigate to current week */
	goToToday: () => void;
};

const dayNames = [
	"Domingo",
	"Segunda-feira",
	"Terça-feira",
	"Quarta-feira",
	"Quinta-feira",
	"Sexta-feira",
	"Sábado",
];

const shortDayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

function getWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	d.setDate(d.getDate() - day);
	d.setHours(0, 0, 0, 0);
	return d;
}

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function generateWeekDays(weekStart: Date): WeekDayData[] {
	const today = new Date();
	const todayStr = formatDate(today);

	const days: WeekDayData[] = [];
	for (let i = 0; i < 7; i++) {
		const d = new Date(weekStart);
		d.setDate(d.getDate() + i);
		const dateStr = formatDate(d);

		days.push({
			date: dateStr,
			dayNumber: d.getDate(),
			dayName: dayNames[d.getDay()],
			shortDayName: shortDayNames[d.getDay()],
			monthName: monthNames[d.getMonth()],
			isToday: dateStr === todayStr,
			isPast: dateStr < todayStr,
		});
	}
	return days;
}

function getWeekRangeLabel(weekDays: WeekDayData[]): string {
	const first = weekDays[0];
	const last = weekDays[6];

	const firstMonth = first.monthName.slice(0, 3);
	const lastMonth = last.monthName.slice(0, 3);

	if (firstMonth === lastMonth) {
		return `${first.dayNumber}-${last.dayNumber} ${firstMonth}`;
	}
	return `${first.dayNumber} ${firstMonth} - ${last.dayNumber} ${lastMonth}`;
}

export function useWeekCalendar(): UseWeekCalendarReturn {
	const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

	const weekDays = useMemo(() => generateWeekDays(weekStart), [weekStart]);

	const weekRangeLabel = useMemo(() => getWeekRangeLabel(weekDays), [weekDays]);

	const startDate = useMemo(() => formatDate(weekStart), [weekStart]);

	const endDate = useMemo(() => {
		const end = new Date(weekStart);
		end.setDate(end.getDate() + 6);
		return formatDate(end);
	}, [weekStart]);

	const goToPreviousWeek = useCallback(() => {
		setWeekStart((prev) => {
			const newDate = new Date(prev);
			newDate.setDate(newDate.getDate() - 7);
			return newDate;
		});
	}, []);

	const goToNextWeek = useCallback(() => {
		setWeekStart((prev) => {
			const newDate = new Date(prev);
			newDate.setDate(newDate.getDate() + 7);
			return newDate;
		});
	}, []);

	const goToToday = useCallback(() => {
		setWeekStart(getWeekStart(new Date()));
	}, []);

	return {
		weekStart,
		weekDays,
		weekRangeLabel,
		startDate,
		endDate,
		goToPreviousWeek,
		goToNextWeek,
		goToToday,
	};
}
