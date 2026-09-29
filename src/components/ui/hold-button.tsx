import { Trash2 } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	useEffect,
	useId,
	useRef,
} from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Tooltip } from "./tooltip";

export const HOLD_BUTTON_MS = 1200;

const HOLD_BUTTON_SIZES = {
	default: { buttonSize: "icon", buttonClassName: "", iconClassName: "size-4" },
	xs: {
		buttonSize: "icon-sm",
		buttonClassName: "size-12 p-0 md:size-6",
		iconClassName: "size-4 md:size-3",
	},
} as const;

type HoldButtonProps = {
	onConfirm: () => void;
	title: string;
	disabled?: boolean;
	className?: string;
	sizeVariant?: keyof typeof HOLD_BUTTON_SIZES;
};

export function HoldButton({
	onConfirm,
	title,
	disabled,
	className,
	sizeVariant = "default",
}: HoldButtonProps) {
	const reduce = useReducedMotion();
	const hintId = useId();
	const progress = useMotionValue(0);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const size = HOLD_BUTTON_SIZES[sizeVariant];

	function start() {
		if (disabled || timer.current) {
			return;
		}

		animate(progress, 1, { duration: HOLD_BUTTON_MS / 1000, ease: "linear" });
		timer.current = setTimeout(() => {
			timer.current = null;
			progress.jump(0);
			onConfirm();
		}, HOLD_BUTTON_MS);
	}

	function cancel() {
		if (!timer.current) {
			return;
		}

		clearTimeout(timer.current);
		timer.current = null;
		animate(progress, 0, { duration: 0.2, ease: "easeOut" });
	}

	useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

	useEffect(() => {
		if (disabled) {
			cancel();
		}
	});

	function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
		if (event.button !== 0) {
			return;
		}

		event.stopPropagation();
		start();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (event.key !== " " && event.key !== "Enter") {
			return;
		}

		event.preventDefault();

		if (!event.repeat) {
			start();
		}
	}

	function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault();
			cancel();
		}
	}

	function handleClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
	}

	return (
		<Tooltip label={`${title}: segure para confirmar`}>
			<Button
				type="button"
				variant="ghost"
				size={size.buttonSize}
				disabled={disabled}
				aria-label={title}
				aria-describedby={hintId}
				onPointerDown={handlePointerDown}
				onPointerUp={cancel}
				onPointerCancel={cancel}
				onPointerLeave={cancel}
				onKeyDown={handleKeyDown}
				onKeyUp={handleKeyUp}
				onBlur={cancel}
				onClick={handleClick}
				onContextMenu={(event) => event.preventDefault()}
				className={cn(
					"relative isolate touch-manipulation select-none overflow-hidden text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-100",
					size.buttonClassName,
					className,
				)}
			>
				<motion.span
					aria-hidden
					className="absolute inset-0 -z-10 origin-left bg-destructive/25"
					style={reduce ? { opacity: progress } : { scaleX: progress }}
				/>
				<Trash2 className={size.iconClassName} />
				<span id={hintId} className="sr-only">
					Segure por {(HOLD_BUTTON_MS / 1000).toLocaleString("pt-BR")} segundos para confirmar
				</span>
			</Button>
		</Tooltip>
	);
}
