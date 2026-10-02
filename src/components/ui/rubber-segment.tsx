import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type KeyboardEvent, useId, useRef } from "react";

import { cn } from "@/lib/utils";

export interface RubberSegmentOption<T extends string> {
	value: T;
	label: string;
	icon?: LucideIcon;
}

const RUBBER_SEGMENT_SPRING = { type: "spring", stiffness: 520, damping: 24, mass: 0.7 } as const;

export function RubberSegment<T extends string>({
	options,
	value,
	onValueChange,
	ariaLabel,
	className,
	itemClassName,
}: {
	options: RubberSegmentOption<T>[];
	value: T;
	onValueChange: (value: T) => void;
	ariaLabel: string;
	className?: string;
	itemClassName?: string;
}) {
	const layoutId = useId();
	const reduceMotion = useReducedMotion();
	const refs = useRef<(HTMLButtonElement | null)[]>([]);

	function select(index: number) {
		const option = options.at(index % options.length);

		if (!option) {
			return;
		}

		refs.current.at(index % options.length)?.focus();
		onValueChange(option.value);
	}

	function onKeyDown(event: KeyboardEvent, index: number) {
		const moves: Record<string, number> = {
			ArrowRight: index + 1,
			ArrowDown: index + 1,
			ArrowLeft: index - 1 + options.length,
			ArrowUp: index - 1 + options.length,
			Home: 0,
			End: options.length - 1,
		};
		const target = moves[event.key];

		if (target === undefined) {
			return;
		}

		event.preventDefault();
		select(target);
	}

	return (
		<div
			role="radiogroup"
			aria-label={ariaLabel}
			className={cn(
				"relative flex shrink-0 items-stretch gap-0.5 rounded-lg bg-muted p-0.5",
				className,
			)}
		>
			{options.map((option, index) => {
				const selected = option.value === value;
				const Icon = option.icon;

				return (
					<button
						key={option.value}
						ref={(node) => {
							refs.current[index] = node;
						}}
						type="button"
						role="radio"
						aria-checked={selected}
						tabIndex={selected ? 0 : -1}
						onClick={() => onValueChange(option.value)}
						onKeyDown={(event) => onKeyDown(event, index)}
						className={cn(
							"relative flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
							selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
							itemClassName,
						)}
					>
						{selected && (
							<motion.span
								layoutId={layoutId}
								aria-hidden
								className="absolute inset-0 rounded-md bg-background shadow-xs"
								transition={reduceMotion ? { duration: 0 } : RUBBER_SEGMENT_SPRING}
							/>
						)}
						{Icon && <Icon className="relative size-4" />}
						<span className="relative">{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}
