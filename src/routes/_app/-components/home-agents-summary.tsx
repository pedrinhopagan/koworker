import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Radio, SquareTerminal } from "lucide-react";
import { toast } from "@/components/ui/toast";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { sortRadarAgents } from "@/lib/agent-radar-status";
import { errorMessage } from "@/lib/orpc-errors";
import { HomeAgentCard } from "./home-agent-card";
import { HomeSectionHeader } from "./home-section-header";

function useAgentActions() {
	const focus = useMutation({
		...orpc.agentRadar.focus.mutationOptions(),
		onError: (error: Error) => toast.error(errorMessage(error, "Falha ao focar o agent")),
	});
	const diff = useMutation({
		...orpc.agentRadar.openDiff.mutationOptions(),
		onError: (error: Error) => toast.error(errorMessage(error, "Falha ao abrir o kw-diff")),
	});
	const close = useMutation({
		...orpc.agentRadar.close.mutationOptions(),
		onError: (error: Error) => toast.error(errorMessage(error, "Falha ao fechar o agent")),
	});

	return {
		onFocus: (paneId: string) => focus.mutate({ paneId }),
		onDiff: (paneId: string) => diff.mutate({ paneId }),
		onClose: (paneId: string) => close.mutate({ paneId }),
	};
}

export function HomeAgentsSummary({ projectId }: { projectId: string }) {
	const { agents, loading } = useAgentRadar();
	const actions = useAgentActions();
	const projectAgents = sortRadarAgents(agents.filter((agent) => agent.projectId === projectId));
	const otherAgents = sortRadarAgents(agents.filter((agent) => agent.projectId !== projectId));

	return (
		<>
			<section aria-labelledby="agents-title" data-component="home-project-agents">
				<HomeSectionHeader
					id="agents-title"
					icon={SquareTerminal}
					title="Agentes"
					count={projectAgents.length}
				>
					<Link
						to="/shells"
						className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						Abrir sala de agentes <ArrowUpRight className="size-3.5" />
					</Link>
				</HomeSectionHeader>

				{loading && <Text tone="muted">Sincronizando agentes...</Text>}
				{!loading && projectAgents.length === 0 && (
					<EmptyFeedback
						icon={Radio}
						title="Nenhum agente aberto neste projeto"
						subtitle="As sessões abertas deste projeto aparecem aqui em qualquer estado."
						className="border border-dashed border-border"
					/>
				)}
				<div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
					{projectAgents.map((agent, index) => (
						<HomeAgentCard key={agent.paneId} agent={agent} index={index} {...actions} />
					))}
				</div>
			</section>

			{otherAgents.length > 0 && (
				<section aria-labelledby="other-agents-title" data-component="home-other-agents">
					<HomeSectionHeader
						id="other-agents-title"
						icon={SquareTerminal}
						title="Agentes de outros projetos"
						count={otherAgents.length}
					/>
					<div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
						{otherAgents.map((agent, index) => (
							<HomeAgentCard key={agent.paneId} agent={agent} index={index} compact {...actions} />
						))}
					</div>
				</section>
			)}
		</>
	);
}
