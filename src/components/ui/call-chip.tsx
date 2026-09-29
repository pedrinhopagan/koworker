import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { StatusMark } from "@/components/ui/status-mark";
import { cn } from "@/lib/utils";

export type CallChipState =
	| { status: "running"; startedAt: number }
	| { status: "done" | "failed"; durationMs: number; exitCode?: number; timedOut?: boolean };

const CALL_CHIP_EASE = [0.23, 1, 0.32, 1] as const;

const CALL_CHIP_TONES = {
	running: "border-primary/30 bg-primary/10 text-primary",
	done: "border-success/30 bg-success/10 text-success",
	failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

function formatSeconds(ms: number) {
	const seconds = ms / 1000;
	return seconds < 10 ? `${seconds.toFixed(1).replace(".", ",")}s` : `${Math.round(seconds)}s`;
}

function useElapsed(startedAt: number | undefined) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (startedAt === undefined) return;
		const timer = setInterval(() => setNow(Date.now()), 100);
		return () => clearInterval(timer);
	}, [startedAt]);

	return startedAt === undefined ? 0 : Math.max(0, now - startedAt);
}

function chipLabel(state: CallChipState, elapsed: number) {
	if (state.status === "running") return `rodando · ${formatSeconds(elapsed)}`;
	if (state.status === "done") return `ok · ${formatSeconds(state.durationMs)}`;
	if (state.timedOut) return "tempo esgotado";
	return `falhou · código ${state.exitCode ?? "?"}`;
}

export function CallChip({
	state,
	className,
}: {
	state: CallChipState | undefined;
	className?: string;
}) {
	const reduce = useReducedMotion();
	const elapsed = useElapsed(state?.status === "running" ? state.startedAt : undefined);
	const transition = { duration: reduce ? 0 : 0.28, ease: CALL_CHIP_EASE };

	return (
		<AnimatePresence initial={false}>
			{state && (
				<motion.span
					layout
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.6 }}
					transition={transition}
					aria-live="polite"
					className={cn(
						"inline-flex h-6 shrink-0 items-center gap-1.5 overflow-hidden rounded-full border px-2 font-mono text-[11px] tabular-nums transition-colors duration-200",
						CALL_CHIP_TONES[state.status],
						className,
					)}
				>
					<motion.span layout="position" transition={transition} className="flex">
						<StatusMark status={state.status} className="size-3.5" />
					</motion.span>
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={state.status}
							layout="position"
							initial={{ opacity: 0, y: reduce ? 0 : 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: reduce ? 0 : -6 }}
							transition={transition}
							className="whitespace-nowrap"
						>
							{chipLabel(state, elapsed)}
						</motion.span>
					</AnimatePresence>
				</motion.span>
			)}
		</AnimatePresence>
	);
}
