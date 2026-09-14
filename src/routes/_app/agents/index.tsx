import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { useAgentCategoriesQuery } from "@/hooks/use-agent-categories";
import { useAgentsQuery } from "@/hooks/use-agents";
import { AgentsGrid } from "./-components/agents-grid";

export const Route = createFileRoute("/_app/agents/")({
	component: AgentsPage,
});

function AgentsPage() {
	const agentsQuery = useAgentsQuery();
	const categoriesQuery = useAgentCategoriesQuery();

	return (
		<PageShell
			title="Agents"
			description="Perfis encontrados nas pastas do opencode, Claude Code e Codex, organizados por categoria"
			icon={Bot}
		>
			<div className="h-full min-h-0 pb-4">
				<AgentsGrid
					agents={agentsQuery.taskAgents}
					categories={categoriesQuery.data ?? []}
					loading={agentsQuery.isLoading}
				/>
			</div>
		</PageShell>
	);
}
