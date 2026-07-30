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
import { ShortcutsSection } from "./-components/shortcuts-section";
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
	agents: RadarAgent[];
	tabs: Workspace["tabs"];
};

// Os workspaces vêm do overview e os agents do radar ao vivo. A ordem é a do kw-terminal (o `number`
// do workspace), pra a página bater com o que está na tela do terminal. Agent de workspace que o
// overview ainda não listou não é descartado: ganha um grupo com o rótulo que o radar reporta e cai
// no fim, porque não tem número pra ancorar.
function buildGroups(workspaces: Workspace[], agents: RadarAgent[]): Group[] {
	const groups = workspaces.map((workspace) => ({
		workspaceId: workspace.workspace_id,
		label: workspace.label,
		number: workspace.number,
		focused: workspace.focused,
		agents: agents.filter((agent) => agent.workspaceId === workspace.workspace_id),
		tabs: workspace.tabs,
	}));

	const known = new Set(workspaces.map((workspace) => workspace.workspace_id));

	for (const agent of agents) {
		if (known.has(agent.workspaceId)) {
			continue;
		}

		known.add(agent.workspaceId);
		groups.push({
			workspaceId: agent.workspaceId,
			label: agent.workspaceLabel,
			number: Number.POSITIVE_INFINITY,
			focused: false,
			agents: agents.filter((candidate) => candidate.workspaceId === agent.workspaceId),
			tabs: [],
		});
	}

	return groups.sort((left, right) => left.number - right.number);
}

function TerminalsPage() {
	const [creating, setCreating] = useState(false);
	const actions = useKwTerminalActions();
	const { agents, loading: radarLoading } = useAgentRadar();
	const overview = useQuery(orpc.kwTerminal.overview.queryOptions());
	const groups = buildGroups(overview.data?.workspaces ?? [], agents);

	return (
		<PageShell
			title="Terminais"
			description="Os agents e workspaces abertos no kw-terminal, ao vivo"
			icon={SquareTerminal}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
			actions={
				<Button size="sm" onClick={() => setCreating(true)}>
					<Plus className="size-4" />
					Abrir nova sessão
				</Button>
			}
		>
			<div className="mx-auto w-full max-w-3xl space-y-6">
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

				{groups.map((group) => (
					<WorkspaceGroup
						key={group.workspaceId}
						workspaceId={group.workspaceId}
						label={group.label}
						number={group.number}
						focused={group.focused}
						agents={group.agents}
						tabs={group.tabs}
						actions={actions}
					/>
				))}

				<ShortcutsSection />
			</div>

			<NewSessionDialog open={creating} onClose={() => setCreating(false)} />
		</PageShell>
	);
}
