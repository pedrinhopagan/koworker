import type { RadarAgent } from "@/api/schemas/terminal-workspace";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CircleAlert, type LucideIcon, Radio, SquareTerminal } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { sortRadarAgents } from "@/lib/agent-radar-status";
import { errorMessage } from "@/lib/orpc-errors";
import { HomeAgentCard } from "./home-agent-card";

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

function needsAttention(agent: RadarAgent) {
	return agent.status === "blocked" || agent.status === "working";
}

function SectionHeader({
	id,
	icon: Icon,
	title,
	count,
	children,
}: {
	id: string;
	icon: LucideIcon;
	title: string;
	count: number;
	children?: ReactNode;
}) {
	return (
		<div className="mb-3 flex items-center justify-between gap-4">
			<div className="flex min-w-0 items-center gap-2">
				<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<Title id={id} as="h2" size="md">
					{title}
				</Title>
				<Text as="span" size="xs" tone="muted" className="font-mono tabular-nums">
					{count}
				</Text>
			</div>
			{children}
		</div>
	);
}

export function HomeAgentsSummary() {
	const { agents, loading } = useAgentRadar();
	const actions = useAgentActions();
	const attention = sortRadarAgents(agents).filter(needsAttention);

	return (
		<section aria-labelledby="attention-title">
			<SectionHeader
				id="attention-title"
				icon={CircleAlert}
				title="Precisa de você"
				count={attention.length}
			>
				<Link
					to="/shells"
					className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					Abrir sala de agents <ArrowUpRight className="size-3.5" />
				</Link>
			</SectionHeader>

			{loading && <Text tone="muted">Sincronizando agents...</Text>}
			{!loading && attention.length === 0 && (
				<EmptyFeedback
					icon={Radio}
					title="Nenhuma intervenção agora"
					subtitle="Nenhum agent está esperando você ou trabalhando."
					className="border border-dashed border-border"
				/>
			)}
			<div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
				{attention.map((agent, index) => (
					<HomeAgentCard key={agent.paneId} agent={agent} index={index} {...actions} />
				))}
			</div>
		</section>
	);
}

export function HomeRecentActivity() {
	const { agents } = useAgentRadar();
	const actions = useAgentActions();
	const others = agents
		.filter((agent) => !needsAttention(agent))
		.sort((a, b) => b.changedAt - a.changedAt);

	if (others.length === 0) {
		return null;
	}

	return (
		<section aria-labelledby="activity-title">
			<SectionHeader
				id="activity-title"
				icon={SquareTerminal}
				title="Outras sessões"
				count={others.length}
			/>
			<div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
				{others.map((agent, index) => (
					<HomeAgentCard key={agent.paneId} agent={agent} index={index} compact {...actions} />
				))}
			</div>
		</section>
	);
}
