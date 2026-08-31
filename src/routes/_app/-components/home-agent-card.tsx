import type { RadarAgent } from "@/api/schemas/terminal-workspace";
import { Link } from "@tanstack/react-router";
import { GitCompare, MessagesSquare, Target, X } from "lucide-react";

import { AgentNavButtons } from "@/components/agent-radar/agent-nav-buttons";
import { AgentNavMenuItems } from "@/components/agent-radar/agent-nav-menu-items";
import { Text } from "@/components/typography";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS, agentRadarAgentLabel } from "@/constants/agent-radar";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

type HomeAgentCardProps = {
	agent: RadarAgent;
	compact?: boolean;
	onFocus: (paneId: string) => void;
	onDiff: (paneId: string) => void;
	onClose: (paneId: string) => void;
};

export function HomeAgentCard({ agent, compact, onFocus, onDiff, onClose }: HomeAgentCardProps) {
	const visual = AGENT_RADAR_VISUALS[agent.status];
	const destination = { tab: `agent:${agent.paneId}` };

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<article
					className={cn(
						"group relative border border-l-2 shadow-xs transition-colors",
						visual.surface,
						visual.edge,
					)}
				>
					<Link
						to="/shells"
						search={destination}
						aria-label={`Abrir conversa de ${agent.agent}`}
						className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
					/>
					<div
						className={cn(
							"pointer-events-none relative z-10 flex min-w-0 gap-3",
							compact ? "p-3" : "p-4",
						)}
					>
						<RadarStatusMark status={agent.status} className="mt-1 shrink-0" />
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 items-center gap-2">
								<Text
									as="span"
									size="xs"
									className="shrink-0 font-mono font-semibold uppercase tracking-[0.08em]"
								>
									{agentRadarAgentLabel(agent.agent)}
								</Text>
								<Text as="span" size="xs" className={cn("truncate", visual.tone)}>
									{AGENT_RADAR_STATUS_LABELS[agent.status]}
								</Text>
								<Text as="span" size="xs" tone="faint" className="ml-auto shrink-0 tabular-nums">
									{relativeTimeFrom(agent.changedAt)}
								</Text>
							</div>
							<Text className={cn("mt-1 truncate font-medium", compact ? "text-xs" : "text-sm")}>
								{agent.taskTitle ?? agent.title ?? agent.activity ?? "Sessão sem tarefa vinculada"}
							</Text>
							{!compact && (
								<Text size="xs" tone="muted" className="mt-1 truncate font-mono">
									{agent.projectName ?? agent.cwd} · {agent.tabLabel}
								</Text>
							)}
						</div>
						<div className="pointer-events-auto relative z-20 self-center">
							<AgentNavButtons
								projectId={agent.projectId}
								projectName={agent.projectName}
								taskId={agent.taskId}
								taskTitle={agent.taskTitle}
								showOpenTask
							/>
						</div>
					</div>
				</article>
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem onSelect={() => onFocus(agent.paneId)}>
					<Target className="size-4" /> Focar no kw-terminal
				</ContextMenuItem>
				<ContextMenuItem asChild>
					<Link to="/shells" search={destination}>
						<MessagesSquare className="size-4" /> Ver conversa
					</Link>
				</ContextMenuItem>
				{(agent.taskId || agent.projectId) && <ContextMenuSeparator />}
				<AgentNavMenuItems
					projectId={agent.projectId}
					projectName={agent.projectName}
					taskId={agent.taskId}
					taskTitle={agent.taskTitle}
				/>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => onDiff(agent.paneId)}>
					<GitCompare className="size-4" /> Ver diff no kw-diff
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => onClose(agent.paneId)} className="text-destructive">
					<X className="size-4" /> Fechar
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
