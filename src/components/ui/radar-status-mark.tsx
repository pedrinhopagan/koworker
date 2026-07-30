import { SnakeLoader } from "@/components/ui/snake-loader";
import type { AgentRadarStatus } from "@/constants/agent-radar";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { cn } from "@/lib/utils";

type Size = "sm" | "md";

type MarkProps = {
	size?: Size;
	className?: string;
	label?: string;
};

const GRID = "grid shrink-0 grid-cols-3 grid-rows-3";

function gridClass(size: Size) {
	return size === "sm" ? "size-3 gap-px" : "size-4 gap-[1.5px]";
}

function BlockedPixels({ size = "sm", className, label }: MarkProps) {
	return (
		<span
			role="status"
			aria-label={label ?? AGENT_RADAR_STATUS_LABELS.blocked}
			className={cn(GRID, gridClass(size), className)}
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

function IdlePixels({ size = "sm", className, label }: MarkProps) {
	return (
		<span
			role="status"
			aria-label={label ?? AGENT_RADAR_STATUS_LABELS.idle}
			className={cn(GRID, gridClass(size), className)}
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

function DimPixels({ size = "sm", className, label }: MarkProps) {
	return (
		<span role="status" aria-label={label} className={cn(GRID, gridClass(size), className)}>
			{Array.from({ length: 9 }, function (_cell, index) {
				return <span key={index} aria-hidden className="bg-current opacity-20" />;
			})}
		</span>
	);
}

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
	const resolved = label ?? AGENT_RADAR_STATUS_LABELS[status];

	if (status === "working") {
		return <SnakeLoader size={size} className={className} label={resolved} />;
	}

	if (status === "blocked") {
		return <BlockedPixels size={size} className={className} label={resolved} />;
	}

	if (status === "idle") {
		return <IdlePixels size={size} className={className} label={resolved} />;
	}

	return <DimPixels size={size} className={className} label={resolved} />;
}
