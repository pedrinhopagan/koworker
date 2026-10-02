import {
	animate,
	motion,
	type PanInfo,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { type MouseEvent, type ReactNode, useRef } from "react";

import { cn } from "@/lib/utils";

export const SWIPE_ROW_COMMIT_RATIO = 0.4;

const SNAP_BACK = { type: "spring", visualDuration: 0.3, bounce: 0.2 } as const;
const INSTANT = { duration: 0 } as const;

type SwipeAction = {
	label: string;
	icon: ReactNode;
	className: string;
	onCommit: () => void;
};

type SwipeRowProps = {
	children: ReactNode;
	right: SwipeAction;
	left: SwipeAction;
	disabled?: boolean;
};

export function SwipeRow({ children, right, left, disabled }: SwipeRowProps) {
	const reduce = useReducedMotion();
	const rootRef = useRef<HTMLDivElement>(null);
	const dragged = useRef(false);
	const x = useMotionValue(0);
	const rightOpacity = useTransform(x, [0, 24], [0, 1]);
	const leftOpacity = useTransform(x, [-24, 0], [1, 0]);

	function handleDragEnd(_event: unknown, info: PanInfo) {
		const width = rootRef.current?.offsetWidth ?? 0;
		const reached = Math.abs(info.offset.x) >= width * SWIPE_ROW_COMMIT_RATIO;

		animate(x, 0, reduce ? INSTANT : SNAP_BACK);

		if (!reached) {
			return;
		}

		if (info.offset.x > 0) {
			right.onCommit();
			return;
		}

		left.onCommit();
	}

	function handleClickCapture(event: MouseEvent) {
		if (!dragged.current) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
	}

	return (
		<div
			ref={rootRef}
			className="relative overflow-hidden"
			onPointerDownCapture={() => {
				dragged.current = false;
			}}
			onClickCapture={handleClickCapture}
		>
			<motion.div
				aria-hidden
				className={cn(
					"absolute inset-0 flex items-center gap-2 px-4 text-sm font-medium",
					right.className,
				)}
				style={{ opacity: rightOpacity }}
			>
				{right.icon}
				{right.label}
			</motion.div>
			<motion.div
				aria-hidden
				className={cn(
					"absolute inset-0 flex items-center justify-end gap-2 px-4 text-sm font-medium",
					left.className,
				)}
				style={{ opacity: leftOpacity }}
			>
				{left.label}
				{left.icon}
			</motion.div>
			<motion.div
				drag={disabled ? false : "x"}
				dragDirectionLock
				dragConstraints={{ left: 0, right: 0 }}
				dragElastic={0.6}
				onDragStart={() => {
					dragged.current = true;
				}}
				onDragEnd={handleDragEnd}
				style={{ x, touchAction: "pan-y" }}
				className="relative"
			>
				{children}
			</motion.div>
		</div>
	);
}
