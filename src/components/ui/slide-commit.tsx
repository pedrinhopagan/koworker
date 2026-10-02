import { ChevronsRight, Loader2 } from "lucide-react";
import {
	animate,
	motion,
	type PanInfo,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { type MouseEvent, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const SLIDE_COMMIT_THRESHOLD = 0.9;
const SLIDE_COMMIT_ERROR_MS = 3000;
const RETURN_SPRING = { type: "spring", stiffness: 520, damping: 26 } as const;
const INSTANT = { duration: 0 } as const;

type SlideCommitProps = {
	label: string;
	pendingLabel: string;
	onConfirm: () => Promise<unknown>;
	describeError: (reason: unknown) => string;
	disabled?: boolean;
	className?: string;
};

export function SlideCommit({
	label,
	pendingLabel,
	onConfirm,
	describeError,
	disabled,
	className,
}: SlideCommitProps) {
	const reduce = useReducedMotion();
	const [phase, setPhase] = useState<"idle" | "pending" | "error">("idle");
	const [error, setError] = useState("");
	const trackRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<HTMLButtonElement>(null);
	const x = useMotionValue(0);
	const fillWidth = useTransform(x, (value) => value + (handleRef.current?.offsetWidth ?? 0));
	const labelOpacity = useTransform(x, [0, 80], [1, 0]);
	const locked = disabled || phase === "pending";

	function travel() {
		return (trackRef.current?.clientWidth ?? 0) - (handleRef.current?.offsetWidth ?? 0);
	}

	function goHome() {
		animate(x, 0, reduce ? INSTANT : RETURN_SPRING);
	}

	async function commit() {
		if (locked) {
			return;
		}

		x.set(travel());
		setPhase("pending");

		try {
			await onConfirm();
			setPhase("idle");
		} catch (reason) {
			setError(describeError(reason));
			setPhase("error");
			setTimeout(() => {
				setPhase((current) => (current === "error" ? "idle" : current));
			}, SLIDE_COMMIT_ERROR_MS);
		}

		goHome();
	}

	function handleDragEnd(_event: unknown, info: PanInfo) {
		if (x.get() >= travel() * SLIDE_COMMIT_THRESHOLD || info.offset.x >= travel()) {
			void commit();
			return;
		}

		goHome();
	}

	function handleClick(event: MouseEvent<HTMLButtonElement>) {
		if (event.detail === 0) {
			void commit();
		}
	}

	return (
		<div
			ref={trackRef}
			data-phase={phase}
			className={cn(
				"relative flex h-9 w-60 items-center overflow-hidden border border-primary bg-primary/10 select-none",
				phase === "error" && "border-destructive bg-destructive/10",
				disabled && "opacity-50",
				className,
			)}
		>
			<motion.span
				aria-hidden
				className="absolute inset-y-0 left-0 bg-primary/25"
				style={{ width: fillWidth }}
			/>
			<motion.span
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-0 flex items-center justify-center pl-9 text-xs font-semibold text-primary",
					phase === "error" && "text-destructive",
				)}
				style={{ opacity: phase === "idle" ? labelOpacity : 1 }}
			>
				{phase === "idle" && label}
				{phase === "pending" && pendingLabel}
				{phase === "error" && error}
			</motion.span>
			<motion.button
				ref={handleRef}
				type="button"
				aria-label={`${label}: deslize ou pressione Enter`}
				aria-busy={phase === "pending"}
				disabled={locked}
				drag={locked ? false : "x"}
				dragConstraints={trackRef}
				dragElastic={0}
				dragMomentum={false}
				onDragEnd={handleDragEnd}
				onClick={handleClick}
				style={{ x }}
				className="relative z-10 grid h-full w-9 shrink-0 cursor-grab touch-none place-items-center bg-primary text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing disabled:cursor-default"
			>
				{phase === "pending" && (
					<Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
				)}
				{phase !== "pending" && <ChevronsRight className="size-4" />}
			</motion.button>
			<span className="sr-only" aria-live="polite">
				{phase === "pending" && pendingLabel}
				{phase === "error" && error}
			</span>
		</div>
	);
}
