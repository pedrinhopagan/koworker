import { createLazyFileRoute } from "@tanstack/react-router";
import { Radar } from "lucide-react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { RadarAgentCard } from "./-components/radar-agent-card";

export const Route = createLazyFileRoute("/_app/radar/")({
	component: RadarPage,
});

function groupByWorkspace(agents: RadarAgent[]) {
	const groups = new Map<string, { label: string; agents: RadarAgent[] }>();

	for (const agent of agents) {
		const group = groups.get(agent.workspaceId);

		if (group) {
			group.agents.push(agent);
		} else {
			groups.set(agent.workspaceId, { label: agent.workspaceLabel, agents: [agent] });
		}
	}

	return [...groups.values()];
}

function RadarPage() {
	const { agents, loading } = useAgentRadar();
	const groups = groupByWorkspace(agents);

	return (
		<PageShell
			title="Radar"
			description="Os agents abertos no kw-terminal, ao vivo"
			icon={Radar}
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-8"
		>
			<div className="mx-auto w-full max-w-3xl space-y-6">
				{loading && (
					<Text size="sm" tone="muted">
						Conectando na central...
					</Text>
				)}

				{!loading && groups.length === 0 && (
					<EmptyFeedback
						icon={Radar}
						title="Nenhum agent aberto"
						subtitle="Abra um claude ou codex no kw-terminal para acompanhar aqui."
					/>
				)}

				{groups.map((group) => (
					<section key={group.label} className="space-y-2">
						<div className="flex items-baseline justify-between gap-2">
							<Title as="h2" size="xs" className="uppercase tracking-wide text-muted-foreground">
								{group.label}
							</Title>

							<Text size="xs" tone="muted">
								{group.agents.length} agent{group.agents.length > 1 ? "s" : ""}
							</Text>
						</div>

						<div className="flex flex-col gap-2">
							{group.agents.map((agent) => (
								<RadarAgentCard key={agent.paneId} agent={agent} />
							))}
						</div>
					</section>
				))}
			</div>
		</PageShell>
	);
}
