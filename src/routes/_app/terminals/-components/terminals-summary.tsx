import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { Text } from "@/components/typography";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { cn } from "@/lib/utils";

export function TerminalsSummary({
	agents,
	workspaces,
}: {
	agents: RadarAgent[];
	workspaces: number;
}) {
	const working = agents.filter(function (agent) {
		return agent.status === "working";
	}).length;
	const waiting = agents.filter(function (agent) {
		return agent.status === "blocked";
	}).length;

	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border border-border bg-card px-4 py-2.5 shadow-[3px_3px_0_var(--border)]">
			<Text size="xs" tone="muted" className="uppercase tracking-[0.2em]">
				Central
			</Text>

			<span className="font-mono text-xs tabular-nums text-muted-foreground">
				{agents.length} agent{agents.length === 1 ? "" : "s"}
				<span className="text-muted-foreground/40"> · </span>
				{workspaces} workspace{workspaces === 1 ? "" : "s"}
			</span>

			<div className="ml-auto flex flex-wrap items-center gap-3">
				{working > 0 && (
					<span className="flex items-center gap-1.5 text-primary">
						<RadarStatusMark status="working" label={AGENT_RADAR_STATUS_LABELS.working} />
						<Text as="span" size="xs" className="tabular-nums text-primary">
							{working} trabalhando
						</Text>
					</span>
				)}

				{waiting > 0 && (
					<span className={cn("flex items-center gap-1.5 text-warning")}>
						<RadarStatusMark status="blocked" label={AGENT_RADAR_STATUS_LABELS.blocked} />
						<Text as="span" size="xs" className="tabular-nums text-warning">
							{waiting} esperando você
						</Text>
					</span>
				)}
			</div>
		</div>
	);
}
