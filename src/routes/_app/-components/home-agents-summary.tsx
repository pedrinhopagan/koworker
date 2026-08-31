import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CircleAlert, Radio, SquareTerminal } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
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

export function HomeAgentsSummary() {
	const { agents, loading } = useAgentRadar();
	const actions = useAgentActions();
	const sorted = sortRadarAgents(agents);
	const attention = sorted.filter(
		(agent) => agent.status === "blocked" || agent.status === "working",
	);
	const blocked = agents.filter((agent) => agent.status === "blocked").length;
	const working = agents.filter((agent) => agent.status === "working").length;

	return (
		<section aria-labelledby="attention-title" className="min-w-0">
			<header className="mb-3 flex items-end justify-between gap-4 border-b border-border pb-3">
				<div>
					<div className="flex items-center gap-2">
						<CircleAlert className="size-4 text-warning" aria-hidden />
						<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
							Fila de atenção
						</Text>
					</div>
					<Title
						id="attention-title"
						as="h2"
						className="mt-2 text-xl tracking-[-0.025em] sm:text-2xl"
					>
						Precisa de você
					</Title>
				</div>
				<Link
					to="/shells"
					className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
				>
					Abrir sala <ArrowUpRight className="size-3.5" />
				</Link>
			</header>

			<div className="mb-4 grid grid-cols-3 border border-border bg-card shadow-xs">
				<AgentCount label="Bloqueados" value={blocked} tone="text-warning" />
				<AgentCount label="Trabalhando" value={working} tone="text-primary" />
				<AgentCount label="Agents" value={agents.length} />
			</div>

			{loading && <Text tone="muted">Sincronizando agents...</Text>}
			{!loading && attention.length === 0 && (
				<div className="border border-dashed border-border bg-card/40 px-5 py-8">
					<Radio className="size-5 text-muted-foreground" aria-hidden />
					<Title as="h3" className="mt-3 text-base">
						Nenhuma intervenção agora
					</Title>
					<Text size="sm" tone="muted" className="mt-1 max-w-md">
						Não há agents bloqueados ou trabalhando. As sessões recentes continuam registradas
						abaixo.
					</Text>
				</div>
			)}
			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
				{attention.map((agent) => (
					<HomeAgentCard key={agent.paneId} agent={agent} {...actions} />
				))}
			</div>
		</section>
	);
}

export function HomeRecentActivity() {
	const { agents, loading } = useAgentRadar();
	const actions = useAgentActions();
	const recent = [...agents].sort((a, b) => b.changedAt - a.changedAt).slice(0, 6);

	return (
		<section aria-labelledby="activity-title" className="border-t border-border pt-5">
			<div className="mb-3 flex items-center justify-between gap-4">
				<div className="flex items-center gap-2">
					<SquareTerminal className="size-4 text-muted-foreground" aria-hidden />
					<Title id="activity-title" as="h2" className="text-base">
						Sessões e atividade
					</Title>
				</div>
				<Text size="xs" tone="muted">
					{recent.length} recentes
				</Text>
			</div>
			{loading && <Text tone="muted">Carregando atividade...</Text>}
			{!loading && recent.length === 0 && (
				<Text size="sm" tone="muted">
					Nenhuma sessão aberta neste momento.
				</Text>
			)}
			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{recent.map((agent) => (
					<HomeAgentCard key={agent.paneId} agent={agent} compact {...actions} />
				))}
			</div>
		</section>
	);
}

function AgentCount({ label, value, tone }: { label: string; value: number; tone?: string }) {
	return (
		<div className="min-w-0 border-r border-border px-3 py-3 last:border-r-0 sm:px-4">
			<Title as="div" className={`text-2xl tabular-nums ${tone ?? ""}`}>
				{value}
			</Title>
			<Text size="xs" tone="muted" className="truncate">
				{label}
			</Text>
		</div>
	);
}
