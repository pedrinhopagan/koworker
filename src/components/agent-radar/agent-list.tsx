import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { memo, useMemo } from "react";
import { toast } from "sonner";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { orpc } from "@/client";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { groupAgentsByProject } from "@/components/agent-radar/agent-groups";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS, agentRadarAgentLabel } from "@/constants/agent-radar";
import { useAgentRadarPreviews } from "@/hooks/use-agent-radar-previews";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { modelDisplayLabel } from "@/lib/model-label";
import { errorMessage } from "@/lib/orpc-errors";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

// Cada cartão só refaz quando o próprio agent muda. O radar reemite a lista inteira a cada transição
// de status, e sem isso um agent trabalhando redesenhava a lista toda a cada passo que dava.
const CompactAgentListItem = memo(function CompactAgentListItem({
	agent,
	selected,
}: {
	agent: RadarAgent;
	selected: boolean;
}) {
	const visual = AGENT_RADAR_VISUALS[agent.status];
	const label = agent.taskTitle ?? agent.title ?? agent.projectName ?? agent.tabLabel;

	return (
		<li
			data-component="agent-list-item"
			data-pane-id={agent.paneId}
			data-selected={selected || undefined}
		>
			<SidebarTooltip
				label={
					<div className="max-w-64">
						<div className="flex items-center gap-2">
							<span className="font-semibold text-popover-foreground">{label}</span>
							<span className={visual.tone}>{AGENT_RADAR_STATUS_LABELS[agent.status]}</span>
						</div>
						<div className="mt-1 truncate text-muted-foreground">
							{agent.projectName ?? agent.cwd} · {agentRadarAgentLabel(agent.agent)}
						</div>
					</div>
				}
				triggerClassName="flex"
			>
				<Link
					to="/terminals/$paneId"
					params={{ paneId: agent.paneId }}
					aria-label={`Abrir conversa de ${label}`}
					className={cn(
						"relative flex size-11 items-center justify-center rounded-lg border border-transparent transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						selected && "border-primary/30 bg-primary/10 text-primary",
					)}
				>
					<RadarStatusMark
						status={agent.status}
						className={cn("absolute top-1.5 right-1.5", visual.tone)}
					/>
					<AgentCliIcon agent={agent.agent} className="size-5" />
				</Link>
			</SidebarTooltip>
		</li>
	);
});

const AgentListItem = memo(function AgentListItem({
	agent,
	selected,
	focused,
	preview,
}: {
	agent: RadarAgent;
	selected: boolean;
	focused: boolean;
	// A última fala e o modelo da conversa, servidos em lote pelo radar. Nulos enquanto não chegaram.
	preview: { text: string | null; model: string | null } | null;
}) {
	const visual = AGENT_RADAR_VISUALS[agent.status];
	const focus = useMutation({
		...orpc.agentRadar.focus.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível focar o agent")),
	});

	return (
		<li
			data-component="agent-list-item"
			data-pane-id={agent.paneId}
			data-status={agent.status}
			data-selected={selected || undefined}
			className={cn(
				"group relative rounded-lg border border-transparent transition-colors",
				selected ? "border-primary/20 bg-primary/10" : "hover:bg-muted/50",
			)}
		>
			<Link
				to="/terminals/$paneId"
				params={{ paneId: agent.paneId }}
				data-slot="open-conversation"
				className="block min-w-0 rounded-lg px-3 py-2.5 pr-[7rem] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<div className="flex min-w-0 items-center gap-1.5">
					<AgentCliIcon agent={agent.agent} className="size-4" />
					<Text as="span" size="xs" className="min-w-0 flex-1 truncate font-semibold">
						{agentRadarAgentLabel(agent.agent)}
					</Text>
				</div>

				<Text size="xs" tone="muted" className="mt-1 min-w-0 truncate">
					{preview?.text ?? agent.activity ?? "Conversa sem falas"}
				</Text>

				<Text size="xs" tone="muted" className="mt-1 truncate font-mono text-[10px]">
					{[
						preview?.model ? modelDisplayLabel(preview.model) : null,
						agent.taskTitle ?? agent.title,
						agent.projectName ?? agent.cwd,
						relativeTimeFrom(agent.changedAt),
					]
						.filter(Boolean)
						.join(" · ")}
				</Text>
			</Link>

			<div className="pointer-events-none absolute inset-y-1.5 right-1.5 flex flex-col items-end justify-between gap-1">
				<span className={cn("flex items-center gap-1.5 whitespace-nowrap", visual.tone)}>
					<Text as="span" size="xs" className="text-[10px] leading-none font-semibold">
						{AGENT_RADAR_STATUS_LABELS[agent.status]}
					</Text>
					<RadarStatusMark status={agent.status} />
				</span>

				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={`Focar ${agentRadarAgentLabel(agent.agent)} no terminal`}
					aria-pressed={focused}
					data-slot="focus-terminal"
					data-selected={focused || undefined}
					onClick={() => focus.mutate({ paneId: agent.paneId })}
					className={cn(
						"pointer-events-auto size-6 border border-transparent opacity-0 transition-[color,background-color,border-color,opacity] group-hover:opacity-100 focus-visible:opacity-100",
						focused &&
							"border-primary/40 bg-primary/10 text-primary opacity-100 hover:bg-primary/15",
					)}
				>
					<Target className="size-3" />
				</Button>
			</div>
		</li>
	);
});

export function AgentList({
	agents,
	selectedPaneId,
	focusedPaneId,
	compact = false,
}: {
	agents: RadarAgent[];
	selectedPaneId?: string;
	focusedPaneId?: string;
	compact?: boolean;
}) {
	const projects = useQuery(orpc.projects.list.queryOptions()).data ?? [];
	const paneIds = useMemo(() => agents.map((agent) => agent.paneId), [agents]);
	const previews = useAgentRadarPreviews(!compact, paneIds);
	const projectColors = useMemo(
		() => new Map(projects.map((project) => [project.id, project.color])),
		[projects],
	);
	const groups = useMemo(() => groupAgentsByProject(agents), [agents]);

	if (compact) {
		return (
			<div data-component="agent-list" className="-mx-2 flex flex-col divide-y divide-border/70">
				{groups.map((group) => (
					<ul
						key={group.id}
						className="flex flex-col items-center gap-1 px-2 py-2 first:pt-0 last:pb-0"
					>
						{group.agents.map((agent) => (
							<CompactAgentListItem
								key={agent.paneId}
								agent={agent}
								selected={agent.paneId === selectedPaneId}
							/>
						))}
					</ul>
				))}
			</div>
		);
	}

	return (
		<div data-component="agent-list" className="-mx-3 divide-y divide-border/70">
			{groups.map((group) => (
				<section
					key={group.id}
					data-component="agent-list-group"
					className="px-3 py-3 first:pt-0 last:pb-0"
				>
					<div className="mb-1.5 flex min-w-0 items-center gap-2 px-2">
						{group.projectId && (
							<span
								aria-hidden="true"
								className="size-2.5 shrink-0 border border-foreground/15"
								style={{
									backgroundColor: projectColors.get(group.projectId) ?? "var(--muted)",
								}}
							/>
						)}
						<Text as="span" size="xs" className="truncate font-semibold">
							{group.label}
						</Text>
						<Text as="span" size="xs" tone="muted" className="truncate font-mono text-[10px]">
							{group.workspaceLabels.join(" · ")}
						</Text>
					</div>
					<ul className="space-y-1">
						{group.agents.map((agent) => (
							<AgentListItem
								key={agent.paneId}
								agent={agent}
								selected={agent.paneId === selectedPaneId}
								focused={agent.paneId === focusedPaneId}
								preview={previews.get(agent.paneId) ?? null}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
