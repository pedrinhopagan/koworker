import { useNavigate } from "@tanstack/react-router";
import { GitCompare, MessagesSquare, MoreVertical, Target, Trash2 } from "lucide-react";
import { useState, type ComponentPropsWithoutRef, type ElementType } from "react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { AgentNavButtons } from "@/components/agent-radar/agent-nav-buttons";
import { AgentNavMenuItems } from "@/components/agent-radar/agent-nav-menu-items";
import { Text } from "@/components/typography";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { AGENT_RADAR_STATUS_LABELS, agentRadarAgentLabel } from "@/constants/agent-radar";
import { useRadarAgentNav } from "@/hooks/use-radar-agent-nav";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { WorkspaceProjectRef } from "../-utils/resolve-workspace-project";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";
import { FocusOnScreenIndicator } from "./focus-on-screen-indicator";
import { RenameDialog } from "./rename-dialog";
import { TERMINALS_ACTION_BUTTON, TERMINALS_CELL, TERMINALS_COLUMNS } from "./table-layout";
import { WorkspaceMenuItems } from "./workspace-menu-items";

type MenuItemComponent = ElementType<ComponentPropsWithoutRef<typeof ContextMenuItem>>;
type MenuSeparatorComponent = ElementType<ComponentPropsWithoutRef<typeof ContextMenuSeparator>>;

type RadarAgentCardProps = {
	agent: RadarAgent;
	focused: boolean;
	displayName: string;
	workspaceLabel: string;
	project: WorkspaceProjectRef | null;
	actions: KwTerminalActions;
};

type AgentActionsMenuProps = {
	agent: RadarAgent;
	displayName: string;
	project: WorkspaceProjectRef | null;
	actions: KwTerminalActions;
	Item: MenuItemComponent;
	Separator: MenuSeparatorComponent;
	onRenameWorkspace: () => void;
	onCloseWorkspace: () => void;
};

function AgentActionsMenu({
	agent,
	displayName,
	project,
	actions,
	Item,
	Separator,
	onRenameWorkspace,
	onCloseWorkspace,
}: AgentActionsMenuProps) {
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
				Fechar agent
			</Item>

			<Separator />

			<WorkspaceMenuItems
				workspaceId={agent.workspaceId}
				displayName={displayName}
				project={project}
				actions={actions}
				Item={Item}
				Separator={Separator}
				onRename={onRenameWorkspace}
				onCloseWorkspace={onCloseWorkspace}
			/>
		</>
	);
}

export function RadarAgentCard({
	agent,
	focused,
	displayName,
	workspaceLabel,
	project,
	actions,
}: RadarAgentCardProps) {
	const { openTask } = useRadarAgentNav();
	const navigate = useNavigate();
	const [renaming, setRenaming] = useState(false);
	const [closing, setClosing] = useState(false);
	const paneId = agent.paneId;
	const taskId = agent.taskId;
	const visual = AGENT_RADAR_VISUALS[agent.status];
	const agentLabel = agentRadarAgentLabel(agent.agent);

	return (
		<li className={cn("transition-colors", visual.surface, focused && "bg-primary/5")}>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div className={cn(TERMINALS_COLUMNS, "relative")}>
						<button
							type="button"
							onClick={function () {
								void navigate({ to: "/terminals/$paneId", params: { paneId } });
							}}
							aria-label={`Abrir a conversa de ${agentLabel}`}
							className="absolute inset-0 cursor-pointer hover:bg-muted/20"
						/>

						<span className={cn(TERMINALS_CELL, "pointer-events-none relative gap-1.5")}>
							<AgentCliIcon agent={agent.agent} className="size-4" />
							<span className="truncate text-xs font-semibold text-foreground">{agentLabel}</span>
							{focused && <FocusOnScreenIndicator variant="item" />}
						</span>

						<span
							className={cn(
								TERMINALS_CELL,
								"pointer-events-none relative gap-1.5 text-xs",
								visual.tone,
							)}
						>
							<RadarStatusMark status={agent.status} />
							<span className="truncate">{AGENT_RADAR_STATUS_LABELS[agent.status]}</span>
						</span>

						<span className={cn(TERMINALS_CELL, "pointer-events-none relative")}>
							<Text as="span" size="xs" tone="muted" className="truncate font-mono">
								{agent.projectName ?? displayName ?? agent.cwd}
								<span className="text-muted-foreground/40"> · </span>
								{agent.tabLabel}
							</Text>
						</span>

						{taskId ? (
							<button
								type="button"
								onClick={function () {
									openTask(taskId, agent.projectId);
								}}
								aria-label={`Abrir tarefa ${agent.taskTitle ?? ""}`.trim()}
								className={cn(
									TERMINALS_CELL,
									"relative z-10 w-full cursor-pointer text-left transition-colors hover:bg-muted/30 hover:text-foreground",
								)}
							>
								<Text as="span" size="xs" className="truncate text-foreground">
									{agent.taskTitle ?? "Tarefa vinculada"}
								</Text>
							</button>
						) : (
							<span className={cn(TERMINALS_CELL, "pointer-events-none relative")}>
								<Text as="span" size="xs" tone="muted">
									—
								</Text>
							</span>
						)}

						<span className={cn(TERMINALS_CELL, "pointer-events-none relative")}>
							<Text as="span" size="xs" tone="muted" className="truncate tabular-nums">
								{relativeTimeFrom(agent.changedAt)}
							</Text>
						</span>

						<div className={cn(TERMINALS_CELL, "relative z-10 justify-end gap-0.5")}>
							<AgentNavButtons
								projectId={agent.projectId}
								projectName={agent.projectName}
								taskId={agent.taskId}
								taskTitle={agent.taskTitle}
								showOpenTask={false}
							/>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										aria-label={`Mais ações do agent ${agentLabel}`}
										className={TERMINALS_ACTION_BUTTON}
									>
										<MoreVertical className="size-3.5" aria-hidden />
									</button>
								</DropdownMenuTrigger>

								<DropdownMenuContent align="end" className="min-w-[220px]">
									<AgentActionsMenu
										agent={agent}
										displayName={displayName}
										project={project}
										actions={actions}
										Item={DropdownMenuItem}
										Separator={DropdownMenuSeparator}
										onRenameWorkspace={function () {
											setRenaming(true);
										}}
										onCloseWorkspace={function () {
											setClosing(true);
										}}
									/>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</ContextMenuTrigger>

				<ContextMenuContent className="min-w-[220px]">
					<AgentActionsMenu
						agent={agent}
						displayName={displayName}
						project={project}
						actions={actions}
						Item={ContextMenuItem}
						Separator={ContextMenuSeparator}
						onRenameWorkspace={function () {
							setRenaming(true);
						}}
						onCloseWorkspace={function () {
							setClosing(true);
						}}
					/>
				</ContextMenuContent>
			</ContextMenu>

			<RenameDialog
				open={renaming}
				title="Renomear workspace"
				initial={workspaceLabel}
				pending={actions.workspaceRename.isPending}
				onClose={function () {
					setRenaming(false);
				}}
				onSubmit={function (next) {
					actions.workspaceRename.mutate(
						{ workspaceId: agent.workspaceId, label: next },
						{
							onSuccess: function () {
								setRenaming(false);
							},
						},
					);
				}}
			/>

			<ConfirmDialog
				open={closing}
				onClose={function () {
					setClosing(false);
				}}
				onConfirm={function () {
					actions.workspaceClose.mutate(
						{ workspaceId: agent.workspaceId },
						{
							onSuccess: function () {
								setClosing(false);
							},
						},
					);
				}}
				title={`Fechar ${displayName}?`}
				description="Todas as tabs e agents deste workspace são encerrados."
				confirmLabel="Fechar"
				variant="danger"
				loading={actions.workspaceClose.isPending}
			/>
		</li>
	);
}
