import { type ReactNode, useEffect, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TooltipProps = {
	label: ReactNode;
	children: ReactNode;
	side?: "top" | "right" | "bottom" | "left";
	align?: "start" | "center" | "end";
	className?: string;
	// Classe do wrapper do gatilho. Default `inline-flex`; passe ex. `flex w-full` quando o gatilho
	// for uma linha que precisa ocupar a largura toda.
	triggerClassName?: string;
	// Atraso (ms) antes de abrir no hover/focus. Default 0 (imediato).
	openDelay?: number;
};

export function Tooltip({
	label,
	children,
	side = "top",
	align = "center",
	className,
	triggerClassName,
	openDelay = 0,
}: TooltipProps) {
	const [open, setOpen] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const trigger = <span className={triggerClassName ?? "inline-flex"}>{children}</span>;

	function clearTimer() {
		if (timer.current) {
			clearTimeout(timer.current);
			timer.current = null;
		}
	}

	function openDelayed() {
		if (!openDelay) {
			setOpen(true);
			return;
		}
		clearTimer();
		timer.current = setTimeout(() => setOpen(true), openDelay);
	}

	function close() {
		clearTimer();
		setOpen(false);
	}

	useEffect(() => clearTimer, []);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				asChild
				onMouseEnter={openDelayed}
				onMouseLeave={close}
				onFocus={openDelayed}
				onBlur={close}
			>
				{trigger}
			</PopoverTrigger>
			<PopoverContent
				side={side}
				align={align}
				className={cn(
					"px-2 py-1 text-xs text-foreground bg-background border border-border",
					className,
				)}
			>
				{label}
			</PopoverContent>
		</Popover>
	);
}
