import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { LatticeLoader } from "@/components/ui/lattice-loader";
import type { AgentRadarStatus } from "@/constants/agent-radar";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { cn } from "@/lib/utils";

type Size = "sm" | "md";

type MarkProps = {
	size?: Size;
	label?: string;
};

const GRID = "grid shrink-0 grid-cols-3 grid-rows-3";

function gridClass(size: Size) {
	return size === "sm" ? "size-3 gap-px" : "size-4 gap-[1.5px]";
}

function BlockedPixels({ size = "sm", label }: MarkProps) {
	return (
		<span
			role="status"
			aria-label={label ?? AGENT_RADAR_STATUS_LABELS.blocked}
			className={cn(GRID, gridClass(size))}
		>
			{Array.from({ length: 9 }, function (_cell, index) {
				const isCenter = index === 4;
				return (
					<span
						key={index}
						aria-hidden
						className={cn(
							"bg-current",
							isCenter ? "animate-status-knock-center" : "animate-status-knock-ring opacity-35",
						)}
						style={isCenter ? undefined : { animationDelay: `${(index % 4) * 0.12}s` }}
					/>
				);
			})}
		</span>
	);
}

function IdlePixels({ size = "sm", label }: MarkProps) {
	return (
		<span
			role="status"
			aria-label={label ?? AGENT_RADAR_STATUS_LABELS.idle}
			className={cn(GRID, gridClass(size))}
		>
			{Array.from({ length: 9 }, function (_cell, index) {
				const row = Math.floor(index / 3);
				const paused = row === 1;
				return (
					<span
						key={index}
						aria-hidden
						className={cn("bg-current", paused ? "opacity-70" : "opacity-15")}
					/>
				);
			})}
		</span>
	);
}

function DimPixels({ size = "sm", label }: MarkProps) {
	return (
		<span role="status" aria-label={label} className={cn(GRID, gridClass(size))}>
			{Array.from({ length: 9 }, function (_cell, index) {
				return <span key={index} aria-hidden className="bg-current opacity-20" />;
			})}
		</span>
	);
}

function StatusPixels({
	status,
	size,
	label,
}: {
	status: AgentRadarStatus;
	size: Size;
	label: string;
}) {
	if (status === "working") {
		return <LatticeLoader size={size} label={label} />;
	}

	if (status === "blocked") {
		return <BlockedPixels size={size} label={label} />;
	}

	if (status === "idle") {
		return <IdlePixels size={size} label={label} />;
	}

	return <DimPixels size={size} label={label} />;
}

const RADAR_MARK_EASE = [0.23, 1, 0.32, 1] as const;

export function RadarStatusMark({
	status,
	size = "sm",
	className,
	label,
}: {
	status: AgentRadarStatus;
	size?: Size;
	className?: string;
	label?: string;
}) {
	const reduce = useReducedMotion();

	return (
		<span className={cn("grid shrink-0 transition-colors duration-200", className)}>
			<AnimatePresence initial={false}>
				<motion.span
					key={status}
					className="grid [grid-area:1/1]"
					initial={{ opacity: 0, scale: reduce ? 1 : 0.5 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: reduce ? 1 : 0.5 }}
					transition={{ duration: reduce ? 0.12 : 0.22, ease: RADAR_MARK_EASE }}
				>
					<StatusPixels
						status={status}
						size={size}
						label={label ?? AGENT_RADAR_STATUS_LABELS[status]}
					/>
				</motion.span>
			</AnimatePresence>
		</span>
	);
}
