import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { toast } from "sonner";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { orpc } from "@/client";
import { groupAgentsByProject } from "@/components/agent-radar/agent-groups";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS, agentRadarAgentLabel } from "@/constants/agent-radar";
import { useAgentRadarTranscript } from "@/hooks/use-agent-radar-transcript";
import { recentTranscriptText } from "@/lib/agent-timeline";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { errorMessage } from "@/lib/orpc-errors";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

function CompactAgentListItem({ agent, selected }: { agent: RadarAgent; selected: boolean }) {
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
					<Text as="span" className="font-mono text-[10px] font-bold uppercase">
						{agentRadarAgentLabel(agent.agent).slice(0, 2)}
					</Text>
				</Link>
			</SidebarTooltip>
		</li>
	);
}

function AgentListItem({
	agent,
	selected,
	focused,
}: {
	agent: RadarAgent;
	selected: boolean;
	focused: boolean;
}) {
	const transcript = useAgentRadarTranscript(agent.paneId);
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
				className="block min-w-0 rounded-lg px-3 py-2.5 pr-11 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<div className="flex min-w-0 items-center gap-2">
					<RadarStatusMark status={agent.status} className={visual.tone} />
					<Text as="span" size="xs" className="min-w-0 flex-1 truncate font-semibold">
						{agent.taskTitle ?? agent.title ?? agent.projectName ?? agent.tabLabel}
					</Text>
					<Text as="span" size="xs" className={cn("shrink-0", visual.tone)}>
						{AGENT_RADAR_STATUS_LABELS[agent.status]}
					</Text>
				</div>

				<Text size="xs" tone="muted" className="mt-1 truncate">
					{agentRadarAgentLabel(agent.agent)} ·{" "}
					{recentTranscriptText(transcript.events) ?? agent.activity ?? "Conversa sem falas"}
				</Text>

				<Text size="xs" tone="muted" className="mt-1 font-mono text-[10px]">
					{agent.projectName ?? agent.cwd} · {relativeTimeFrom(agent.changedAt)}
				</Text>
			</Link>

			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={`Focar ${agent.agent} no terminal`}
				aria-pressed={focused}
				data-slot="focus-terminal"
				data-selected={focused || undefined}
				onClick={() => focus.mutate({ paneId: agent.paneId })}
				className={cn(
					"absolute top-1.5 right-1.5 size-8 border border-transparent opacity-0 transition-[color,background-color,border-color,opacity] group-hover:opacity-100 focus-visible:opacity-100",
					focused && "border-primary/40 bg-primary/10 text-primary opacity-100 hover:bg-primary/15",
				)}
			>
				<Target className="size-3.5" />
			</Button>
		</li>
	);
}

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
	const projectColors = new Map(projects.map((project) => [project.id, project.color]));
	const groups = groupAgentsByProject(agents);

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
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
