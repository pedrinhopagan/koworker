import type { CSSProperties } from "react";

import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import type { AgendaEvent } from "@/types/agenda";

// Cor hex arbitrária não entra em variante de Chip/Badge (que só aceitam token) — aplica-se via
// style inline, no padrão do icon.tsx (sufixo de alpha em hex; color-mix para CSS vars).
function withAlpha(value: string, alpha: string) {
	if (value.startsWith("#") && value.length === 7) {
		return `${value}${alpha}`;
	}
	return `color-mix(in oklab, ${value} 20%, transparent)`;
}

type EventChipProps = {
	event: AgendaEvent;
	onClick?: () => void;
	compact?: boolean;
};

export function EventChip({ event, onClick, compact }: EventChipProps) {
	const color = event.displayColor ?? "var(--primary)";
	const time = event.allDay ? null : event.startAt.slice(11, 16);
	const isDone = event.done === true;

	const style: CSSProperties = {
		backgroundColor: withAlpha(color, "1f"),
		boxShadow: `inset 2px 0 0 ${color}`,
	};

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onClick?.();
			}}
			style={style}
			title={event.displayTitle}
			className={cn(
				"flex w-full items-center gap-1.5 overflow-hidden rounded-none px-1.5 text-left transition-opacity hover:opacity-80",
				compact ? "h-5 text-[11px]" : "h-6 text-xs",
				isDone && "opacity-50",
			)}
		>
			{event.icon && <LucideIcon name={event.icon} className="size-3 shrink-0" />}
			{time && (
				<span className="shrink-0 tabular-nums" style={{ color }}>
					{time}
				</span>
			)}
			<span className={cn("truncate", isDone && "line-through")}>{event.displayTitle}</span>
		</button>
	);
}
