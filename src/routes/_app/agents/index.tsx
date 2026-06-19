import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { useAgentsQuery } from "@/hooks/use-agents";
import { AgentsGrid } from "./-components/agents-grid";

export const Route = createFileRoute("/_app/agents/")({
	component: AgentsPage,
});

function AgentsPage() {
	const agentsQuery = useAgentsQuery();

	return (
		<PageShell
			title="Agents"
			description="Agents encontrados nas pastas do opencode, Claude Code, Codex e Agents"
			icon={Bot}
		>
			<div className="h-full min-h-0 pb-4">
				<AgentsGrid agents={agentsQuery.taskAgents} loading={agentsQuery.isLoading} />
			</div>
		</PageShell>
	);
}
