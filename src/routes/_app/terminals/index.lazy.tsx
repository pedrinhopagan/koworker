import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Plus, SquareTerminal } from "lucide-react";
import { useState } from "react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { orpc, type RouterOutputs } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { NewSessionDialog } from "./-components/new-session-dialog";
import { RestoreSnapshotCard } from "./-components/restore-snapshot-card";
import { ShortcutsSection } from "./-components/shortcuts-section";
import { TerminalsSummary } from "./-components/terminals-summary";
import { WorkspaceGroup } from "./-components/workspace-group";
import { useKwTerminalActions } from "./-utils/use-kw-terminal-actions";

export const Route = createLazyFileRoute("/_app/terminals/")({
	component: TerminalsPage,
});

type Workspace = RouterOutputs["kwTerminal"]["overview"]["workspaces"][number];

type Group = {
	workspaceId: string;
	label: string;
	number: number;
	focused: boolean;
	focusedPaneId: string | null;
	agents: RadarAgent[];
	tabs: Workspace["tabs"];
};

function buildGroups(
	workspaces: Workspace[],
	agents: RadarAgent[],
	focus: { workspaceId: string | null; tabId: string | null; paneId: string | null },
): Group[] {
	const groups = workspaces.map(function (workspace) {
		return {
			workspaceId: workspace.workspace_id,
			label: workspace.label,
			number: workspace.number,
			focused: focus.workspaceId === workspace.workspace_id,
			focusedPaneId: focus.workspaceId === workspace.workspace_id ? focus.paneId : null,
			agents: agents.filter(function (agent) {
				return agent.workspaceId === workspace.workspace_id;
			}),
			tabs: workspace.tabs.map(function (tab) {
				return {
					...tab,
					focused: focus.tabId === tab.tab_id,
				};
			}),
		};
	});

	const known = new Set(
		workspaces.map(function (workspace) {
			return workspace.workspace_id;
		}),
	);

	for (const agent of agents) {
		if (known.has(agent.workspaceId)) {
			continue;
		}

		known.add(agent.workspaceId);
		groups.push({
			workspaceId: agent.workspaceId,
			label: agent.workspaceLabel,
			number: Number.POSITIVE_INFINITY,
			focused: focus.workspaceId === agent.workspaceId,
			focusedPaneId: focus.workspaceId === agent.workspaceId ? focus.paneId : null,
			agents: agents.filter(function (candidate) {
				return candidate.workspaceId === agent.workspaceId;
			}),
			tabs: [],
		});
	}

	return groups.sort(function (left, right) {
		return left.number - right.number;
	});
}

function TerminalsPage() {
	const [creating, setCreating] = useState(false);
	const actions = useKwTerminalActions();
	const { agents, focus, loading: radarLoading } = useAgentRadar();
	const overview = useQuery(orpc.kwTerminal.overview.queryOptions());
	const groups = buildGroups(overview.data?.workspaces ?? [], agents, focus);

	return (
		<PageShell
			title="Terminais"
			description="Central de agents e workspaces do kw-terminal"
			icon={SquareTerminal}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
			actions={
				<Button
					size="sm"
					onClick={function () {
						setCreating(true);
					}}
				>
					<Plus className="size-4" />
					Abrir nova sessão
				</Button>
			}
		>
			<div className="mx-auto w-full max-w-5xl space-y-5">
				<RestoreSnapshotCard hasLiveAgents={agents.length > 0} />

				{groups.length > 0 && <TerminalsSummary agents={agents} workspaces={groups.length} />}

				{(radarLoading || overview.isLoading) && groups.length === 0 && (
					<Text size="sm" tone="muted">
						Conectando na central...
					</Text>
				)}

				{overview.isError && groups.length === 0 && (
					<EmptyFeedback
						icon={SquareTerminal}
						title="kw-terminal indisponível"
						subtitle="Não foi possível falar com o servidor kw-terminal desta máquina."
					/>
				)}

				{!radarLoading && !overview.isLoading && !overview.isError && groups.length === 0 && (
					<EmptyFeedback
						icon={SquareTerminal}
						title="Nenhum terminal aberto"
						subtitle="Abra uma sessão por aqui ou suba um claude/codex no kw-terminal."
					/>
				)}

				{groups.map(function (group) {
					return (
						<WorkspaceGroup
							key={group.workspaceId}
							workspaceId={group.workspaceId}
							label={group.label}
							number={group.number}
							focused={group.focused}
							focusedPaneId={group.focusedPaneId}
							agents={group.agents}
							tabs={group.tabs}
							actions={actions}
						/>
					);
				})}

				<ShortcutsSection />
			</div>

			<NewSessionDialog
				open={creating}
				onClose={function () {
					setCreating(false);
				}}
			/>
		</PageShell>
	);
}
