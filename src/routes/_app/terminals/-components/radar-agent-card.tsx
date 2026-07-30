import { useNavigate } from "@tanstack/react-router";
import { GitCompare, MessagesSquare, MoreVertical, Target, Trash2 } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementType } from "react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { AgentNavMenuItems } from "@/components/agent-radar/agent-nav-menu-items";
import { Text } from "@/components/typography";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { Tooltip } from "@/components/ui/tooltip";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";

export const AGENT_COLUMNS =
	"grid grid-cols-[4.75rem_8.5rem_minmax(8rem,1fr)_minmax(8rem,1.2fr)_5.25rem_4.5rem] items-stretch";

export const AGENT_CELL = "flex min-w-0 items-center px-3 py-2.5";

export const AGENT_HEADER_CELL =
	"text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

const ACTION_BUTTON =
	"relative inline-flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";

type MenuItemComponent = ElementType<ComponentPropsWithoutRef<typeof ContextMenuItem>>;
type MenuSeparatorComponent = ElementType<ComponentPropsWithoutRef<typeof ContextMenuSeparator>>;

type RadarAgentCardProps = { agent: RadarAgent; focused: boolean; actions: KwTerminalActions };

type AgentActionsMenuProps = {
	agent: RadarAgent;
	actions: KwTerminalActions;
	Item: MenuItemComponent;
	Separator: MenuSeparatorComponent;
};

function AgentActionsMenu({ agent, actions, Item, Separator }: AgentActionsMenuProps) {
	const navigate = useNavigate();
	const paneId = agent.paneId;

	return (
		<>
			<Item
				onSelect={function () {
					actions.agentFocus.mutate({ paneId });
				}}
			>
				<Target className="size-4" />
				Focar no kw-terminal
			</Item>

			<Item
				onSelect={function () {
					void navigate({ to: "/terminals/$paneId", params: { paneId } });
				}}
			>
				<MessagesSquare className="size-4" />
				Ver conversa
			</Item>

			{(agent.taskId || agent.projectId) && <Separator />}

			<AgentNavMenuItems
				projectId={agent.projectId}
				projectName={agent.projectName}
				taskId={agent.taskId}
				taskTitle={agent.taskTitle}
				Item={Item}
			/>

			<Separator />

			<Item
				onSelect={function () {
					actions.agentDiff.mutate({ paneId });
				}}
			>
				<GitCompare className="size-4" />
				Ver diff no kw-diff
			</Item>

			<Item
				onSelect={function () {
					actions.agentClose.mutate({ paneId });
				}}
				className="text-destructive"
			>
				<Trash2 className="size-4" />
				Fechar
			</Item>
		</>
	);
}

export function RadarAgentCard({ agent, focused, actions }: RadarAgentCardProps) {
	const paneId = agent.paneId;
	const visual = AGENT_RADAR_VISUALS[agent.status];

	return (
		<li className={cn("transition-colors", visual.surface, focused && "bg-primary/5")}>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div>
						<div className={cn(AGENT_COLUMNS, "relative")}>
							<button
								type="button"
								onClick={function () {
									actions.agentFocus.mutate({ paneId });
								}}
								aria-label={`Focar o agent ${agent.agent} no kw-terminal`}
								className="absolute inset-0 cursor-pointer hover:bg-muted/20"
							/>

							<span
								className={cn(
									AGENT_CELL,
									"pointer-events-none relative font-mono text-xs font-semibold uppercase tracking-[0.08em] text-foreground",
								)}
							>
								{agent.agent}
							</span>

							<span
								className={cn(
									AGENT_CELL,
									"pointer-events-none relative gap-1.5 text-xs",
									visual.tone,
								)}
							>
								<RadarStatusMark status={agent.status} />
								<span className="truncate">{AGENT_RADAR_STATUS_LABELS[agent.status]}</span>
							</span>

							<span className={cn(AGENT_CELL, "pointer-events-none relative")}>
								{agent.taskId ? (
									<Text as="span" size="xs" className="truncate text-foreground">
										{agent.taskTitle ?? "Tarefa vinculada"}
									</Text>
								) : (
									<Text as="span" size="xs" tone="muted" className="truncate">
										{agent.projectName ?? agent.tabLabel}
									</Text>
								)}
							</span>

							<span className={cn(AGENT_CELL, "pointer-events-none relative")}>
								{agent.activity ? (
									<Text as="span" size="xs" className="truncate text-foreground/80">
										{agent.activity}
									</Text>
								) : (
									<Text as="span" size="xs" tone="muted" className="truncate font-mono">
										{agent.tabLabel}
									</Text>
								)}
							</span>

							<span className={cn(AGENT_CELL, "pointer-events-none relative")}>
								<Text as="span" size="xs" tone="muted" className="truncate tabular-nums">
									{relativeTimeFrom(agent.changedAt)}
								</Text>
							</span>

							<div className={cn(AGENT_CELL, "relative z-10 justify-end gap-0.5")}>
								<Tooltip label="Fechar">
									<button
										type="button"
										onClick={function () {
											actions.agentClose.mutate({ paneId });
										}}
										aria-label={`Fechar o agent ${agent.agent}`}
										className={cn(ACTION_BUTTON, "hover:text-destructive")}
									>
										<Trash2 className="size-3.5" aria-hidden />
									</button>
								</Tooltip>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											aria-label={`Mais ações do agent ${agent.agent}`}
											className={ACTION_BUTTON}
										>
											<MoreVertical className="size-3.5" aria-hidden />
										</button>
									</DropdownMenuTrigger>

									<DropdownMenuContent align="end">
										<AgentActionsMenu
											agent={agent}
											actions={actions}
											Item={DropdownMenuItem}
											Separator={DropdownMenuSeparator}
										/>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
					</div>
				</ContextMenuTrigger>

				<ContextMenuContent>
					<AgentActionsMenu
						agent={agent}
						actions={actions}
						Item={ContextMenuItem}
						Separator={ContextMenuSeparator}
					/>
				</ContextMenuContent>
			</ContextMenu>
		</li>
	);
}
