import { useNavigate } from "@tanstack/react-router";
import { memo, useMemo } from "react";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

function getWeekDates(): {
	date: string;
	dayNumber: number;
	weekDay: string;
	isToday: boolean;
}[] {
	const today = new Date();
	const dayOfWeek = today.getDay();
	const sunday = new Date(today);
	sunday.setDate(today.getDate() - dayOfWeek);

	const todayStr = today.toISOString().split("T")[0];

	return WEEK_DAYS.map((weekDay, index) => {
		const date = new Date(sunday);
		date.setDate(sunday.getDate() + index);
		const dateStr = date.toISOString().split("T")[0];
		return {
			date: dateStr,
			dayNumber: date.getDate(),
			weekDay,
			isToday: dateStr === todayStr,
		};
	});
}

type WeekDayCardProps = {
	dayNumber: number;
	weekDay: string;
	isToday: boolean;
	taskCount: number;
	isSelected: boolean;
	onClick: () => void;
};

const WeekDayCard = memo(function WeekDayCard({
	dayNumber,
	weekDay,
	isToday,
	taskCount,
	isSelected,
	onClick,
}: WeekDayCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"group relative flex flex-col items-center p-3 min-h-[90px]",
				"bg-card",
				"transition-colors duration-200 cursor-pointer",
				"hover:border-primary/40 hover:bg-muted/30",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				isSelected ? "border-2 border-primary/80 bg-primary/5" : "border border-border",
			)}
		>
			{isToday && (
				<Chip
					variant="primary"
					size="xs"
					shape="square"
					fill
					className="absolute -top-2 right-1 shadow-sm z-10 font-medium"
				>
					Hoje
				</Chip>
			)}

			{isToday && (
				<div
					className="absolute inset-0 opacity-20 pointer-events-none"
					style={{
						background:
							"radial-gradient(ellipse at center, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
					}}
				/>
			)}

			<span
				className={cn(
					"text-xs transition-colors duration-200",
					isSelected
						? "text-primary font-medium"
						: isToday
							? "text-primary font-medium"
							: "text-muted-foreground",
				)}
			>
				{weekDay}
			</span>

			<span
				className={cn(
					"text-xl font-semibold mt-1",
					isSelected ? "text-primary" : isToday ? "text-primary" : "text-foreground",
				)}
			>
				{dayNumber}
			</span>

			<div className="flex items-center gap-1.5 mt-2">
				{taskCount > 0 && (
					<div className="flex items-center gap-1">
						<div className="w-1.5 h-1.5 rounded-full bg-primary" />
						<span className="text-xs text-muted-foreground group-hover:text-foreground">
							{taskCount}
						</span>
					</div>
				)}
			</div>

			{(taskCount > 0 || isSelected) && (
				<div
					className={cn(
						"absolute bottom-0 left-0 right-0 h-[2px] transition-opacity duration-200",
						"opacity-0 group-hover:opacity-100",
						isSelected && "opacity-100",
					)}
					style={{
						background: isSelected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.6)",
					}}
				/>
			)}
		</button>
	);
});

type WeekCalendarProps = {
	tasks: TaskWithMeta[];
	selectedDate: string;
	onDateSelect: (date: string) => void;
};

export const WeekCalendar = memo(function WeekCalendar({
	tasks,
	selectedDate,
	onDateSelect,
}: WeekCalendarProps) {
	const navigate = useNavigate();
	const weekDates = useMemo(() => getWeekDates(), []);

	// Count tasks per date (placeholder - tasks don't have scheduledDate yet)
	const taskCountByDate = useMemo(() => {
		const counts = new Map<string, number>();
		// For now, show fake counts for demo
		const today = new Date().toISOString().split("T")[0];
		counts.set(today, tasks.filter((t) => t.status === "pending").length);
		return counts;
	}, [tasks]);

	const handleDayClick = (date: string) => {
		if (selectedDate === date) {
			// Double click - navigate to agenda with selected date
			navigate({ to: "/agenda", search: { inicio: date } });
		} else {
			onDateSelect(date);
		}
	};

	return (
		<div className="grid grid-cols-7 gap-2">
			{weekDates.map((day) => (
				<WeekDayCard
					key={day.date}
					dayNumber={day.dayNumber}
					weekDay={day.weekDay}
					isToday={day.isToday}
					taskCount={taskCountByDate.get(day.date) ?? 0}
					isSelected={selectedDate === day.date}
					onClick={() => handleDayClick(day.date)}
				/>
			))}
		</div>
	);
});
