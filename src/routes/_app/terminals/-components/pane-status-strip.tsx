import { Radio } from "lucide-react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { Text } from "@/components/typography";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

// A faixa que fica colada no topo da conversa: de longe é a cor do ponto, de perto é a atividade que
// o daemon reporta. É o que responde "e agora?" sem ninguém precisar ler o rastro.
export function PaneStatusStrip({ agent, closed }: { agent: RadarAgent | null; closed: boolean }) {
	if (closed) {
		return (
			<div className="sticky top-0 z-10 flex items-center gap-2 border border-dashed border-border bg-background/95 px-3 py-2 backdrop-blur">
				<span className="size-1.5 shrink-0 bg-border" aria-hidden />
				<Text as="span" size="xs" tone="muted">
					Terminal fechado — esta é a conversa que ficou gravada em disco.
				</Text>
			</div>
		);
	}

	if (!agent) {
		return null;
	}

	const visual = AGENT_RADAR_VISUALS[agent.status];

	return (
		<div
			className={cn(
				"sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur",
				agent.status === "blocked" && "border-warning/40 bg-warning/8",
			)}
		>
			<span className={visual.tone}>
				<RadarStatusMark status={agent.status} />
			</span>

			<Text
				as="span"
				size="xs"
				className={cn("shrink-0 font-bold uppercase tracking-[0.12em]", visual.tone)}
			>
				{AGENT_RADAR_STATUS_LABELS[agent.status]}
			</Text>

			<Text as="span" size="xs" tone="muted" className="min-w-0 flex-1 truncate">
				{agent.activity ?? agent.tabLabel}
			</Text>

			<span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
				<Radio className="size-3" />
				{relativeTimeFrom(agent.changedAt)}
			</span>
		</div>
	);
}
