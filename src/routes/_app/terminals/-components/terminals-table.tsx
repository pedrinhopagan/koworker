import { MoreVertical, SquareTerminal } from "lucide-react";
import { useState } from "react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Text, Title } from "@/components/typography";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS, agentRadarAgentLabel } from "@/constants/agent-radar";
import { AGENT_RADAR_VISUALS, sortRadarAgents } from "@/lib/agent-radar-status";
import { cn } from "@/lib/utils";
import type { WorkspaceProjectRef } from "../-utils/resolve-workspace-project";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";
import { FocusOnScreenIndicator } from "./focus-on-screen-indicator";
import { RadarAgentCard } from "./radar-agent-card";
import { RenameDialog } from "./rename-dialog";
import {
	TERMINALS_ACTION_BUTTON,
	TERMINALS_CELL,
	TERMINALS_COLUMNS,
	TERMINALS_HEADER_CELL,
} from "./table-layout";
import { TerminalTabRow } from "./terminal-tab-row";
import { WorkspaceMenuItems } from "./workspace-menu-items";

type WorkspaceTab = { tabId: string; label: string; focused: boolean };

export type TerminalsWorkspace = {
	workspaceId: string;
	label: string;
	displayName: string;
	number: number;
	focused: boolean;
	focusedPaneId: string | null;
	agents: RadarAgent[];
	tabs: WorkspaceTab[];
	project: WorkspaceProjectRef | null;
};

type TerminalsTableProps = {
	workspaces: TerminalsWorkspace[];
	actions: KwTerminalActions;
};

type WorkspaceSectionProps = {
	workspace: TerminalsWorkspace;
	actions: KwTerminalActions;
};

function WorkspaceSection({ workspace, actions }: WorkspaceSectionProps) {
	const [renaming, setRenaming] = useState(false);
	const [closing, setClosing] = useState(false);

	const working = workspace.agents.some(function (agent) {
		return agent.status === "working";
	});
	const waiting = workspace.agents.filter(function (agent) {
		return agent.status === "blocked";
	}).length;
	const focusedTabId =
		workspace.tabs.find(function (tab) {
			return tab.focused;
		})?.tabId ?? null;
	const agentTabIds = new Set(
		workspace.agents.map(function (agent) {
			return agent.tabId;
		}),
	);
	const plainTabs = workspace.tabs.filter(function (tab) {
		return !agentTabIds.has(tab.tabId);
	});
	const sorted = sortRadarAgents(workspace.agents);
	const clis = [
		...new Set(
			sorted.map(function (agent) {
				return agent.agent;
			}),
		),
	];
	const empty = workspace.agents.length === 0 && plainTabs.length === 0;

	return (
		<section
			className={cn(
				"border border-border bg-card shadow-[3px_3px_0_var(--border)]",
				workspace.focused && "border-primary/60 shadow-[3px_3px_0_var(--primary)]",
				!workspace.focused && waiting > 0 && "border-warning/50",
			)}
		>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<header className="flex items-center gap-2 border-b border-border px-3 py-1.5">
						{Number.isFinite(workspace.number) && (
							<span
								className={cn(
									"flex size-5 shrink-0 items-center justify-center border border-border font-mono text-[10px] tabular-nums",
									working ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
								)}
							>
								{workspace.number}
							</span>
						)}

						<Title as="h2" size="xs" className="min-w-0 truncate uppercase tracking-[0.14em]">
							{workspace.displayName}
						</Title>

						{clis.length > 0 && (
							<span className="flex shrink-0 items-center gap-1.5">
								{clis.map(function (cli) {
									return (
										<span
											key={cli}
											title={agentRadarAgentLabel(cli)}
											className="inline-flex items-center gap-1 border border-border/70 bg-muted/40 px-1.5 py-0.5"
										>
											<AgentCliIcon agent={cli} className="size-3" />
											<Text as="span" size="xs" tone="muted" className="text-[10px]">
												{agentRadarAgentLabel(cli)}
											</Text>
										</span>
									);
								})}
							</span>
						)}

						{workspace.focused && <FocusOnScreenIndicator variant="workspace" />}

						{waiting > 0 && (
							<span
								className={cn(
									"inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
									AGENT_RADAR_VISUALS.blocked.tone,
								)}
							>
								<RadarStatusMark status="blocked" />
								{waiting} esperando
							</span>
						)}

						{working && (
							<span className="shrink-0 text-primary">
								<RadarStatusMark status="working" label="Workspace com agent trabalhando" />
							</span>
						)}

						<Text size="xs" tone="muted" className="ml-auto shrink-0 tabular-nums">
							{workspace.agents.length === 0
								? "sem agent"
								: `${workspace.agents.length} agent${workspace.agents.length > 1 ? "s" : ""}`}
						</Text>

						<div
							onContextMenu={function (event) {
								event.stopPropagation();
							}}
							onPointerDown={function (event) {
								event.stopPropagation();
							}}
						>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										aria-label={`Ações do workspace ${workspace.displayName}`}
										className={TERMINALS_ACTION_BUTTON}
									>
										<MoreVertical className="size-3.5" aria-hidden />
									</button>
								</DropdownMenuTrigger>

								<DropdownMenuContent align="end" className="min-w-[220px]">
									<WorkspaceMenuItems
										workspaceId={workspace.workspaceId}
										displayName={workspace.displayName}
										project={workspace.project}
										actions={actions}
										Item={DropdownMenuItem}
										Separator={DropdownMenuSeparator}
										onRename={function () {
											setRenaming(true);
										}}
										onCloseWorkspace={function () {
											setClosing(true);
										}}
									/>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</header>
				</ContextMenuTrigger>

				<ContextMenuContent className="min-w-[220px]">
					<WorkspaceMenuItems
						workspaceId={workspace.workspaceId}
						displayName={workspace.displayName}
						project={workspace.project}
						actions={actions}
						onRename={function () {
							setRenaming(true);
						}}
						onCloseWorkspace={function () {
							setClosing(true);
						}}
					/>
				</ContextMenuContent>
			</ContextMenu>

			{!empty && (
				<div className="overflow-x-auto">
					<div className="min-w-[48rem]">
						<div className={cn(TERMINALS_COLUMNS, "border-b border-border bg-muted/30")} role="row">
							<span className={cn(TERMINALS_CELL, TERMINALS_HEADER_CELL)}>Agent</span>
							<span className={cn(TERMINALS_CELL, TERMINALS_HEADER_CELL)}>Status</span>
							<span className={cn(TERMINALS_CELL, TERMINALS_HEADER_CELL)}>Onde</span>
							<span className={cn(TERMINALS_CELL, TERMINALS_HEADER_CELL)}>Tarefa</span>
							<span className={cn(TERMINALS_CELL, TERMINALS_HEADER_CELL)}>Atualizado</span>
							<span className={cn(TERMINALS_CELL, TERMINALS_HEADER_CELL, "justify-end")}>
								Ações
							</span>
						</div>

						<ul className="divide-y divide-border">
							{sorted.map(function (agent) {
								return (
									<RadarAgentCard
										key={agent.paneId}
										agent={agent}
										focused={
											workspace.focused &&
											(workspace.focusedPaneId
												? agent.paneId === workspace.focusedPaneId
												: agent.tabId === focusedTabId)
										}
										displayName={workspace.displayName}
										workspaceLabel={workspace.label}
										project={workspace.project}
										actions={actions}
									/>
								);
							})}

							{plainTabs.map(function (tab) {
								return (
									<TerminalTabRow
										key={tab.tabId}
										tabId={tab.tabId}
										label={tab.label}
										focused={workspace.focused && tab.focused}
										workspaceId={workspace.workspaceId}
										workspaceLabel={workspace.label}
										displayName={workspace.displayName}
										project={workspace.project}
										actions={actions}
									/>
								);
							})}
						</ul>
					</div>
				</div>
			)}

			{empty && (
				<div className="px-3 py-2">
					<Text size="xs" tone="muted">
						Workspace vazio.
					</Text>
				</div>
			)}

			<RenameDialog
				open={renaming}
				title="Renomear workspace"
				initial={workspace.label}
				pending={actions.workspaceRename.isPending}
				onClose={function () {
					setRenaming(false);
				}}
				onSubmit={function (next) {
					actions.workspaceRename.mutate(
						{ workspaceId: workspace.workspaceId, label: next },
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
						{ workspaceId: workspace.workspaceId },
						{
							onSuccess: function () {
								setClosing(false);
							},
						},
					);
				}}
				title={`Fechar ${workspace.displayName}?`}
				description="Todas as tabs e agents deste workspace são encerrados."
				confirmLabel="Fechar"
				variant="danger"
				loading={actions.workspaceClose.isPending}
			/>
		</section>
	);
}

export function TerminalsTable({ workspaces, actions }: TerminalsTableProps) {
	const agents = workspaces.flatMap(function (workspace) {
		return workspace.agents;
	});
	const working = agents.filter(function (agent) {
		return agent.status === "working";
	}).length;
	const waiting = agents.filter(function (agent) {
		return agent.status === "blocked";
	}).length;

	return (
		<div className="space-y-4">
			<header className="flex items-center gap-2 border border-border bg-card px-4 py-2 shadow-[3px_3px_0_var(--border)]">
				<SquareTerminal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<Text size="xs" tone="muted" className="uppercase tracking-[0.2em]">
					Agents no kw-terminal
				</Text>

				<div className="ml-auto flex items-center gap-3">
					{working > 0 && (
						<span className="flex items-center gap-1.5 text-primary">
							<RadarStatusMark status="working" label={AGENT_RADAR_STATUS_LABELS.working} />
							<Text as="span" size="xs" className="tabular-nums text-primary">
								{working}
							</Text>
						</span>
					)}

					{waiting > 0 && (
						<span className="flex items-center gap-1.5 text-warning">
							<RadarStatusMark status="blocked" />
							<Text as="span" size="xs" className="tabular-nums text-warning">
								{waiting} esperando você
							</Text>
						</span>
					)}

					<Text as="span" size="xs" tone="muted" className="tabular-nums">
						{workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}
					</Text>
				</div>
			</header>

			{workspaces.map(function (workspace) {
				return (
					<WorkspaceSection key={workspace.workspaceId} workspace={workspace} actions={actions} />
				);
			})}
		</div>
	);
}
