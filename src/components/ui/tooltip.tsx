import {
	type MouseEvent,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
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
	// Força a tooltip fechada e ignora os gatilhos de hover/focus. Usado quando outra camada (ex.: um
	// menu de contexto sobre o mesmo gatilho) está aberta e a tooltip brigaria com ela.
	disabled?: boolean;
};

const LONG_PRESS_MS = 500;
const TOUCH_AUTO_CLOSE_MS = 4000;

export function Tooltip({
	label,
	children,
	side = "top",
	align = "center",
	className,
	triggerClassName,
	openDelay = 0,
	disabled = false,
}: TooltipProps) {
	const [open, setOpen] = useState(false);
	const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const suppressClick = useRef(false);
	const fromTouch = useRef(false);

	function clearTimers() {
		for (const timer of [hoverTimer, pressTimer, autoCloseTimer]) {
			if (timer.current) {
				clearTimeout(timer.current);
				timer.current = null;
			}
		}
	}

	function close() {
		clearTimers();
		suppressClick.current = false;
		setOpen(false);
	}

	function openDelayed() {
		if (disabled) {
			return;
		}
		if (!openDelay) {
			setOpen(true);
			return;
		}
		clearTimers();
		hoverTimer.current = setTimeout(() => setOpen(true), openDelay);
	}

	function handlePointerEnter(event: PointerEvent) {
		if (event.pointerType !== "mouse") {
			return;
		}
		fromTouch.current = false;
		openDelayed();
	}

	function handlePointerLeave(event: PointerEvent) {
		if (event.pointerType !== "mouse") {
			return;
		}
		close();
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.pointerType === "mouse") {
			close();
			return;
		}
		fromTouch.current = true;
		close();
		if (disabled) {
			return;
		}
		pressTimer.current = setTimeout(() => {
			suppressClick.current = true;
			setOpen(true);
			autoCloseTimer.current = setTimeout(() => setOpen(false), TOUCH_AUTO_CLOSE_MS);
		}, LONG_PRESS_MS);
	}

	function cancelPress() {
		if (pressTimer.current) {
			clearTimeout(pressTimer.current);
			pressTimer.current = null;
		}
	}

	function handleFocus() {
		if (fromTouch.current) {
			return;
		}
		openDelayed();
	}

	function handleBlur() {
		fromTouch.current = false;
		close();
	}

	function handleClickCapture(event: MouseEvent) {
		if (!suppressClick.current) {
			return;
		}
		suppressClick.current = false;
		event.preventDefault();
		event.stopPropagation();
	}

	useEffect(() => clearTimers, []);

	return (
		<Popover open={open && !disabled} onOpenChange={setOpen}>
			<PopoverAnchor asChild>
				<span
					className={triggerClassName ?? "inline-flex"}
					onPointerEnter={handlePointerEnter}
					onPointerLeave={handlePointerLeave}
					onPointerDown={handlePointerDown}
					onPointerUp={cancelPress}
					onPointerCancel={cancelPress}
					onClickCapture={handleClickCapture}
					onFocus={handleFocus}
					onBlur={handleBlur}
				>
					{children}
				</span>
			</PopoverAnchor>
			<PopoverContent
				side={side}
				align={align}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
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
