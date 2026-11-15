import { Link } from "@tanstack/react-router";
import { Bot, FolderOpen, Loader2 } from "lucide-react";
import type { RouterOutputs } from "@/client";
import { ProjectLogo } from "@/components/project-logo";
import { Text } from "@/components/typography";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import {
	AGENT_RADAR_STATUS_LABELS,
	agentRadarAgentLabel,
	type AgentRadarStatus,
} from "@/constants/agent-radar";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useAgentRadarPreviews } from "@/hooks/use-agent-radar-previews";
import { AGENT_RADAR_VISUALS, sortRadarAgents } from "@/lib/agent-radar-status";
import { cn } from "@/lib/utils";
import { ConversationSidebarHeader } from "@/routes/_app/chat/-components/conversation-sidebar-header";

type AgentEntry = {
	key: string;
	projectId: string | null;
	projectName: string;
	title: string;
	summary: string;
	agent: string;
	status: AgentRadarStatus;
	changedAt: number;
	search: { id?: string; paneId?: string };
};

export function ConversationAgents({
	conversations,
	search,
	selectedId,
	selectedPaneId,
}: {
	conversations: RouterOutputs["conversations"]["list"];
	search: string;
	selectedId?: string;
	selectedPaneId?: string;
}) {
	const { agents, loading } = useAgentRadar();
	const { projects, setSelectedProjectId } = useProjectFocus();
	const previews = useAgentRadarPreviews(
		agents.length > 0,
		agents.map((agent) => agent.paneId),
	);
	const liveThreads = new Set(agents.map((agent) => agent.sessionId));
	const entries: AgentEntry[] = [
		...agents.map((agent) => ({
			key: agent.paneId,
			projectId: agent.projectId,
			projectName: agent.projectName ?? agent.workspaceLabel,
			title:
				[agent.title, agent.taskTitle, agent.tabLabel].find((value) => !!value?.trim()) ??
				agentRadarAgentLabel(agent.agent),
			summary:
				[agent.activity, previews.get(agent.paneId)?.text].find((value) => !!value?.trim()) ??
				"Sem atividade recente",
			agent: agent.agent,
			status: agent.status,
			changedAt: agent.changedAt,
			search: { paneId: agent.paneId },
		})),
		...conversations
			.filter(
				(conversation) =>
					(conversation.busy || conversation.waiting) && !liveThreads.has(conversation.threadId),
			)
			.map((conversation) => ({
				key: conversation.id,
				projectId: conversation.projectId,
				projectName: conversation.projectName,
				title: conversation.title,
				summary: conversation.preview ?? conversation.title,
				agent: "codex",
				status: conversation.waiting ? ("blocked" as const) : ("working" as const),
				changedAt: conversation.updatedAt,
				search: { id: conversation.id },
			})),
	];
	const filtered = sortRadarAgents(
		entries.filter((entry) =>
			`${entry.projectName} ${entry.title} ${entry.summary} ${entry.agent}`
				.toLocaleLowerCase("pt-BR")
				.includes(search.toLocaleLowerCase("pt-BR")),
		),
	);
	const projectOrder = new Map(projects.map((project, index) => [project.id, index]));
	const groups = [...new Set(filtered.map((entry) => entry.projectId ?? entry.projectName))]
		.map((key) => ({
			key,
			project: projects.find((project) => project.id === key),
			entries: filtered.filter((entry) => (entry.projectId ?? entry.projectName) === key),
		}))
		.sort(
			(left, right) =>
				(projectOrder.get(left.key) ?? projects.length) -
				(projectOrder.get(right.key) ?? projects.length),
		);
	const working = filtered.filter((entry) => entry.status === "working").length;
	const waiting = filtered.filter((entry) => entry.status === "blocked").length;
	return (
		<section
			data-section="conversation-agents"
			className="flex flex-col lg:min-h-0 lg:flex-[2_1_0%] lg:overflow-hidden"
			aria-label="Agentes abertos de todos os projetos"
		>
			<ConversationSidebarHeader icon={Bot} title="Agentes abertos">
				<Text size="xs" tone="faint" className="tabular-nums">
					{filtered.length}
				</Text>
			</ConversationSidebarHeader>
			<div className="py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
				<Text size="xs" tone="faint" className="px-3 pb-3">
					{working} trabalhando · {waiting} esperando
				</Text>
				{loading && entries.length === 0 && (
					<div role="status" className="flex h-16 items-center justify-center">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				)}
				{!loading && filtered.length === 0 && (
					<EmptyFeedback
						icon={Bot}
						title={search ? "Nenhum agent encontrado" : "Nenhum agent aberto"}
						subtitle="As sessões do kw-terminal aparecem aqui."
						className="px-3 py-4"
					/>
				)}
				<nav aria-label="Agents abertos por projeto">
					{groups.map((group) => (
						<div key={group.key} className="mb-3 last:mb-0">
							<Text as="div" size="xs" tone="muted" className="mb-1 flex items-center gap-2 px-3">
								{group.project && <ProjectLogo project={group.project} className="size-5" />}
								{!group.project && <FolderOpen className="size-3 shrink-0" />}
								<span className="truncate">{group.entries[0]?.projectName}</span>
							</Text>
							{group.entries.map((entry) => {
								const selected =
									(!!entry.search.id && selectedId === entry.search.id) ||
									(!!entry.search.paneId && selectedPaneId === entry.search.paneId);
								const visual = AGENT_RADAR_VISUALS[entry.status];
								return (
									<Link
										key={entry.key}
										to="/chat"
										search={entry.search}
										onClick={() => {
											if (entry.projectId) {
												setSelectedProjectId(entry.projectId);
											}
										}}
										aria-current={selected ? "page" : undefined}
										data-status={entry.status}
										className={cn(
											"mx-2 mb-1 block border border-l-2 px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
											visual.surface,
											visual.edge,
											selected && "ring-1 ring-ring",
										)}
									>
										<div className="flex items-center gap-2">
											<RadarStatusMark status={entry.status} className={visual.tone} />
											<Text size="xs" className="min-w-0 flex-1 truncate font-semibold">
												{agentRadarAgentLabel(entry.agent)}
											</Text>
											<span className={cn("shrink-0 text-[10px]", visual.tone)}>
												{AGENT_RADAR_STATUS_LABELS[entry.status]}
											</span>
										</div>
										<Text size="sm" className="mt-2 line-clamp-2 break-words leading-snug">
											{entry.title}
										</Text>
										{entry.summary !== entry.title && (
											<Text
												size="xs"
												tone="muted"
												className="mt-1 line-clamp-2 break-words leading-relaxed"
											>
												{entry.summary}
											</Text>
										)}
									</Link>
								);
							})}
						</div>
					))}
				</nav>
			</div>
		</section>
	);
}
