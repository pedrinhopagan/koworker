import { LatticeLoader } from "@/components/ui/lattice-loader";
import { cn } from "@/lib/utils";

type AgentNavLayout = "compact" | "expanded" | "drawer";

export function AgentWaitingBadge({ count, layout }: { count: number; layout: AgentNavLayout }) {
	if (count <= 0) {
		return null;
	}

	if (layout === "drawer") {
		return (
			<span className="ml-auto min-w-5 rounded bg-warning/20 px-1.5 text-center text-xs font-semibold text-warning">
				{count}
			</span>
		);
	}

	return (
		<span
			className={cn(
				"absolute z-10 min-w-3 rounded-[3px] bg-warning/35 px-0.5 text-center font-semibold text-[8px] leading-[11px] text-warning",
				layout === "compact" ? "-top-1.5 -right-1.5" : "-top-2 -right-2",
			)}
		>
			{count}
		</span>
	);
}

export function AgentWorkingPulse({ layout, count }: { layout: AgentNavLayout; count: number }) {
	if (count <= 0) {
		return null;
	}

	const label = `${count} agent${count > 1 ? "s" : ""} trabalhando`;

	if (layout === "compact") {
		return (
			<LatticeLoader label={label} className="absolute -right-1.5 -bottom-1.5 z-10 text-primary" />
		);
	}

	return <LatticeLoader label={label} className="text-primary" />;
}
