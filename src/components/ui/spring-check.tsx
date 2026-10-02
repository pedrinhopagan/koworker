import { motion, useReducedMotion } from "motion/react";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

const SPRING_CHECK_TRANSITION = { type: "spring", visualDuration: 0.2, bounce: 0.35 } as const;
const INSTANT = { duration: 0 } as const;

function useSpringCheckTransition() {
	return useReducedMotion() ? INSTANT : SPRING_CHECK_TRANSITION;
}

type SpringCheckProps = {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
	"aria-label"?: string;
};

export function SpringCheck({
	checked,
	onCheckedChange,
	disabled,
	className,
	"aria-label": ariaLabel,
}: SpringCheckProps) {
	const transition = useSpringCheckTransition();

	function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (event.key === "Enter") {
			event.preventDefault();
		}
	}

	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={checked}
			aria-label={ariaLabel}
			disabled={disabled}
			onKeyDown={handleKeyDown}
			onClick={() => onCheckedChange(!checked)}
			className={cn(
				"relative grid size-4 shrink-0 cursor-pointer place-items-center overflow-hidden border border-input bg-transparent shadow-xs outline-none transition-[border-color,transform] duration-150 hover:border-primary/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 aria-checked:border-primary motion-reduce:active:scale-100 dark:bg-input/30",
				className,
			)}
		>
			<motion.span
				aria-hidden
				className="absolute inset-0 bg-primary"
				initial={false}
				animate={{ scale: checked ? 1 : 0 }}
				transition={transition}
			/>
			<svg
				aria-hidden
				viewBox="0 0 24 24"
				className="relative size-3 fill-none stroke-primary-foreground stroke-[3] [stroke-linecap:round] [stroke-linejoin:round]"
			>
				<motion.path
					d="M5 12.5l4.5 4.5L19 7.5"
					initial={false}
					animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
					transition={transition}
				/>
			</svg>
		</button>
	);
}

export function SpringStrike({ active }: { active: boolean }) {
	const transition = useSpringCheckTransition();

	return (
		<motion.span
			aria-hidden
			className="pointer-events-none absolute inset-x-0 top-1/2 h-px origin-left bg-current"
			initial={false}
			animate={{ scaleX: active ? 1 : 0 }}
			transition={transition}
		/>
	);
}
