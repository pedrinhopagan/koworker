import { useDroppable } from "@dnd-kit/core";

import { Text } from "@/components/typography";
import { cn } from "@/lib/utils";
import type { AgendaEvent } from "@/types/agenda";
import { EventChip } from "./event-chip";

type EventDayCellProps = {
	date: string;
	dayNumber: number;
	dayName?: string;
	events: AgendaEvent[];
	maxVisible: number;
	isToday: boolean;
	isPast: boolean;
	muted?: boolean;
	className?: string;
	onCreate: () => void;
	onEventClick: (event: AgendaEvent) => void;
};

export function EventDayCell({
	date,
	dayNumber,
	dayName,
	events,
	maxVisible,
	isToday,
	isPast,
	muted,
	className,
	onCreate,
	onEventClick,
}: EventDayCellProps) {
	const { setNodeRef, isOver } = useDroppable({ id: `day:${date}`, data: { type: "day", date } });
	const visible = events.slice(0, maxVisible);
	const overflow = events.length - visible.length;

	return (
		// div role="button" (não <button>): os chips são <button> aninhados — button dentro de
		// button é HTML inválido. O onClick cria evento no espaço vazio; o clique no chip não
		// chega aqui (EventChip faz stopPropagation).
		<div
			ref={setNodeRef}
			role="button"
			tabIndex={0}
			onClick={onCreate}
			onKeyDown={(e) => {
				if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					onCreate();
				}
			}}
			className={cn(
				"flex cursor-pointer flex-col items-stretch gap-1 border border-border bg-card p-1.5 text-left transition-colors hover:bg-secondary/30",
				isToday && "bg-primary/[0.06] ring-1 ring-inset ring-primary/45",
				isOver && "ring-2 ring-inset ring-primary",
				muted && "bg-muted/25",
				className,
			)}
		>
			<div
				className={cn(
					"flex items-center justify-between gap-1",
					isPast && !isToday && "opacity-60",
				)}
			>
				{dayName && (
					<Text as="span" size="xs" tone="muted" className="uppercase tracking-wide">
						{dayName}
					</Text>
				)}
				<span
					className={cn(
						"flex size-5 items-center justify-center text-xs tabular-nums",
						isToday && "rounded-full bg-primary font-medium text-primary-foreground",
						!isToday && "text-foreground",
					)}
				>
					{dayNumber}
				</span>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
				{visible.map((event) => (
					<EventChip key={event.id} event={event} compact onClick={() => onEventClick(event)} />
				))}
				{overflow > 0 && (
					<Text as="span" size="xs" tone="muted" className="px-1.5">
						+{overflow} mais
					</Text>
				)}
			</div>
		</div>
	);
}
