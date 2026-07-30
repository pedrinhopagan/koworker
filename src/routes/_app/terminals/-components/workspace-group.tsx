import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { Text, Title } from "@/components/typography";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_VISUALS, sortRadarAgents } from "@/lib/agent-radar-status";
import { cn } from "@/lib/utils";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";
import { FocusOnScreenIndicator } from "./focus-on-screen-indicator";
import { AGENT_CELL, AGENT_COLUMNS, AGENT_HEADER_CELL, RadarAgentCard } from "./radar-agent-card";
import { TerminalTabRow } from "./terminal-tab-row";
import { WorkspaceActionsMenu } from "./workspace-actions-menu";

type WorkspaceTab = { tab_id: string; label: string; focused: boolean };

type WorkspaceGroupProps = {
	workspaceId: string;
	label: string;
	number: number;
	focused: boolean;
	focusedPaneId: string | null;
	agents: RadarAgent[];
	tabs: WorkspaceTab[];
	actions: KwTerminalActions;
};

export function WorkspaceGroup({
	workspaceId,
	label,
	number,
	focused,
	focusedPaneId,
	agents,
	tabs,
	actions,
}: WorkspaceGroupProps) {
	const [showTabs, setShowTabs] = useState(false);
	const agentTabIds = new Set(
		agents.map(function (agent) {
			return agent.tabId;
		}),
	);
	const plainTabs = tabs.filter(function (tab) {
		return !agentTabIds.has(tab.tab_id);
	});
	const working = agents.some(function (agent) {
		return agent.status === "working";
	});
	const waiting = agents.filter(function (agent) {
		return agent.status === "blocked";
	}).length;
	const focusedTabId =
		tabs.find(function (tab) {
			return tab.focused;
		})?.tab_id ?? null;
	const sorted = sortRadarAgents(agents);

	return (
		<section
			className={cn(
				"border border-border bg-card shadow-[3px_3px_0_var(--border)]",
				focused && "border-primary/60 shadow-[3px_3px_0_var(--primary)]",
				!focused && waiting > 0 && "border-warning/50",
			)}
		>
			<header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
				{Number.isFinite(number) && (
					<span
						className={cn(
							"flex size-6 shrink-0 items-center justify-center border border-border font-mono text-xs tabular-nums",
							working ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
						)}
					>
						{number}
					</span>
				)}

				<Title as="h2" size="xs" className="min-w-0 truncate uppercase tracking-[0.14em]">
					{label}
				</Title>

				{focused && <FocusOnScreenIndicator variant="workspace" />}

				{waiting > 0 && (
					<span
						className={cn(
							"inline-flex shrink-0 items-center gap-1.5 px-1.5 py-0.5 text-xs font-semibold",
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
					{agents.length === 0
						? "sem agent"
						: `${agents.length} agent${agents.length > 1 ? "s" : ""}`}
				</Text>

				<WorkspaceActionsMenu workspaceId={workspaceId} label={label} actions={actions} />
			</header>

			{agents.length > 0 && (
				<div className="overflow-x-auto">
					<div className="min-w-[48rem]">
						<div className={cn(AGENT_COLUMNS, "border-b border-border bg-muted/30")} role="row">
							<span className={cn(AGENT_CELL, AGENT_HEADER_CELL)}>Agent</span>
							<span className={cn(AGENT_CELL, AGENT_HEADER_CELL)}>Status</span>
							<span className={cn(AGENT_CELL, AGENT_HEADER_CELL)}>Tarefa</span>
							<span className={cn(AGENT_CELL, AGENT_HEADER_CELL)}>Atividade</span>
							<span className={cn(AGENT_CELL, AGENT_HEADER_CELL)}>Atualizado</span>
							<span className={cn(AGENT_CELL, AGENT_HEADER_CELL, "justify-end")}>Ações</span>
						</div>

						<ul className="divide-y divide-border">
							{sorted.map(function (agent) {
								return (
									<RadarAgentCard
										key={agent.paneId}
										agent={agent}
										focused={
											focused &&
											(focusedPaneId
												? agent.paneId === focusedPaneId
												: agent.tabId === focusedTabId)
										}
										actions={actions}
									/>
								);
							})}
						</ul>
					</div>
				</div>
			)}

			{agents.length === 0 && plainTabs.length === 0 && (
				<div className="px-4 py-3">
					<Text size="xs" tone="muted">
						Workspace vazio.
					</Text>
				</div>
			)}

			{plainTabs.length > 0 && (
				<div className={cn("space-y-1 px-3 py-2", agents.length > 0 && "border-t border-border")}>
					<button
						type="button"
						onClick={function () {
							setShowTabs(function (open) {
								return !open;
							});
						}}
						className="flex cursor-pointer items-center gap-1 text-xs uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
					>
						{showTabs ? (
							<ChevronDown className="size-3.5" />
						) : (
							<ChevronRight className="size-3.5" />
						)}
						{plainTabs.length} terminal{plainTabs.length > 1 ? "s" : ""} sem agent
					</button>

					{showTabs && (
						<ul className="divide-y divide-border border border-border">
							{plainTabs.map(function (tab) {
								return (
									<TerminalTabRow
										key={tab.tab_id}
										tabId={tab.tab_id}
										label={tab.label}
										focused={focused && tab.focused}
										actions={actions}
									/>
								);
							})}
						</ul>
					)}
				</div>
			)}
		</section>
	);
}
