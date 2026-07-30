import { Link } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { Text } from "@/components/typography";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { AGENT_RADAR_STATUS_LABELS, type AgentRadarStatus } from "@/constants/agent-radar";
import { relativeTimeFrom } from "@/lib/relative-time";

const STATUS_BADGE: Record<AgentRadarStatus, BadgeVariant> = {
	working: "default",
	blocked: "warning",
	done: "success",
	idle: "muted",
	unknown: "outline",
};

// A faixa lateral é o que se lê de longe: a cor sozinha já diz se o agent anda, parou esperando ou
// terminou, antes de qualquer texto.
const STATUS_EDGE: Record<AgentRadarStatus, string> = {
	working: "border-l-primary",
	blocked: "border-l-accent",
	done: "border-l-primary/60",
	idle: "border-l-border",
	unknown: "border-l-border",
};

export function RadarAgentCard({ agent }: { agent: RadarAgent }) {
	return (
		<article
			className={`flex flex-col gap-2 border border-l-2 border-border bg-card p-3 ${STATUS_EDGE[agent.status]}`}
		>
			<div className="flex flex-wrap items-center gap-2">
				{agent.status === "working" && (
					<span className="size-1.5 animate-pulse bg-primary" aria-hidden />
				)}

				<span className="font-mono text-sm text-foreground">{agent.agent}</span>

				<Badge variant={STATUS_BADGE[agent.status]}>
					{AGENT_RADAR_STATUS_LABELS[agent.status]}
				</Badge>

				<Text size="xs" tone="muted" className="ml-auto shrink-0">
					{relativeTimeFrom(agent.changedAt)}
				</Text>
			</div>

			{agent.activity && (
				<Text size="sm" className="break-words">
					{agent.activity}
				</Text>
			)}

			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
				{agent.projectId && agent.projectName ? (
					<Link to="/projetos/$projetoId" params={{ projetoId: agent.projectId }}>
						{agent.projectName}
					</Link>
				) : (
					<span className="break-all">{agent.cwd}</span>
				)}

				<span>·</span>
				<span className="break-all">{agent.tabLabel}</span>

				{/* Entrar na conversa é a ação do cartão, mas não pode roubar o toque do link do projeto:
				    por isso é um alvo próprio, à direita, e não o cartão inteiro clicável. */}
				<Link
					to="/radar/$paneId"
					params={{ paneId: agent.paneId }}
					className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-border bg-muted/40 px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted"
				>
					<MessagesSquare className="size-3.5 text-primary" />
					Conversa
				</Link>
			</div>
		</article>
	);
}
