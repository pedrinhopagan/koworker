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
import { TerminalsTable, type TerminalsWorkspace } from "./-components/terminals-table";
import { resolveWorkspaceProject } from "./-utils/resolve-workspace-project";
import { useKwTerminalActions } from "./-utils/use-kw-terminal-actions";

export const Route = createLazyFileRoute("/_app/terminals/")({
	component: TerminalsPage,
});

type Workspace = RouterOutputs["kwTerminal"]["overview"]["workspaces"][number];
type Project = RouterOutputs["projects"]["list"][number];

function buildWorkspaces(
	workspaces: Workspace[],
	agents: RadarAgent[],
	focus: { workspaceId: string | null; tabId: string | null; paneId: string | null },
	projects: Project[],
): TerminalsWorkspace[] {
	const groups = workspaces.map(function (workspace) {
		const workspaceAgents = agents.filter(function (agent) {
			return agent.workspaceId === workspace.workspace_id;
		});
		const resolved = resolveWorkspaceProject({
			workspaceLabel: workspace.label,
			agents: workspaceAgents,
			projects,
		});

		return {
			workspaceId: workspace.workspace_id,
			label: workspace.label,
			displayName: resolved.displayName,
			number: workspace.number,
			focused: focus.workspaceId === workspace.workspace_id,
			focusedPaneId: focus.workspaceId === workspace.workspace_id ? focus.paneId : null,
			agents: workspaceAgents,
			tabs: workspace.tabs.map(function (tab) {
				return {
					tabId: tab.tab_id,
					label: tab.label,
					focused: focus.tabId === tab.tab_id,
				};
			}),
			project: resolved.project,
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

		const orphanAgents = agents.filter(function (candidate) {
			return candidate.workspaceId === agent.workspaceId;
		});
		const resolved = resolveWorkspaceProject({
			workspaceLabel: agent.workspaceLabel,
			agents: orphanAgents,
			projects,
		});

		groups.push({
			workspaceId: agent.workspaceId,
			label: agent.workspaceLabel,
			displayName: resolved.displayName,
			number: Number.POSITIVE_INFINITY,
			focused: focus.workspaceId === agent.workspaceId,
			focusedPaneId: focus.workspaceId === agent.workspaceId ? focus.paneId : null,
			agents: orphanAgents,
			tabs: [],
			project: resolved.project,
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
	const projects = useQuery(orpc.projects.list.queryOptions());
	const workspaces = buildWorkspaces(
		overview.data?.workspaces ?? [],
		agents,
		focus,
		projects.data ?? [],
	);

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

				{(radarLoading || overview.isLoading) && workspaces.length === 0 && (
					<Text size="sm" tone="muted">
						Conectando na central...
					</Text>
				)}

				{overview.isError && workspaces.length === 0 && (
					<EmptyFeedback
						icon={SquareTerminal}
						title="kw-terminal indisponível"
						subtitle="Não foi possível falar com o servidor kw-terminal desta máquina."
					/>
				)}

				{!radarLoading && !overview.isLoading && !overview.isError && workspaces.length === 0 && (
					<EmptyFeedback
						icon={SquareTerminal}
						title="Nenhum terminal aberto"
						subtitle="Abra uma sessão por aqui ou suba um claude/codex no kw-terminal."
					/>
				)}

				{workspaces.length > 0 && <TerminalsTable workspaces={workspaces} actions={actions} />}

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
