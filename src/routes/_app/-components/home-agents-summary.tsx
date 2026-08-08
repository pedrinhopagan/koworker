import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, GitCompare, MessagesSquare, SquareTerminal, Target, X } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { AgentNavButtons } from "@/components/agent-radar/agent-nav-buttons";
import { AgentNavMenuItems } from "@/components/agent-radar/agent-nav-menu-items";
import { Text } from "@/components/typography";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS, agentRadarAgentLabel } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useRadarAgentNav } from "@/hooks/use-radar-agent-nav";
import { AGENT_RADAR_VISUALS, sortRadarAgents } from "@/lib/agent-radar-status";
import { errorMessage } from "@/lib/orpc-errors";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const COLUMNS =
	"grid grid-cols-[4.75rem_8.75rem_minmax(6rem,0.85fr)_minmax(10rem,1.35fr)_5.75rem_3.5rem] items-stretch";

const CELL = "flex min-w-0 items-center px-3 py-2.5";

const HEADER_CELL = "text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

export function HomeAgentsSummary() {
	const navigate = useNavigate();
	const { openTask } = useRadarAgentNav();
	const { agents, loading } = useAgentRadar();

	const focus = useMutation({
		...orpc.agentRadar.focus.mutationOptions(),
		onError: function (error: Error) {
			toast.error(errorMessage(error, "Falha ao focar o agent"));
		},
	});

	const diff = useMutation({
		...orpc.agentRadar.openDiff.mutationOptions(),
		onError: function (error: Error) {
			toast.error(errorMessage(error, "Falha ao abrir o kw-diff"));
		},
	});

	const close = useMutation({
		...orpc.agentRadar.close.mutationOptions(),
		onError: function (error: Error) {
			toast.error(errorMessage(error, "Falha ao fechar o agent"));
		},
	});

	if (loading || agents.length === 0) {
		return null;
	}

	const sorted = sortRadarAgents(agents);
	const working = agents.filter(function (agent) {
		return agent.status === "working";
	}).length;
	const waiting = agents.filter(function (agent) {
		return agent.status === "blocked";
	}).length;

	function handleOpen(paneId: string) {
		void navigate({ to: "/terminals/$paneId", params: { paneId } });
	}

	return (
		<section className="mt-10 border border-border bg-card shadow-[3px_3px_0_var(--border)]">
			<header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
				<SquareTerminal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<Text size="xs" tone="muted" className="uppercase tracking-[0.2em]">
					Agents no kw-terminal
				</Text>

				<div className="ml-auto flex items-center gap-3">
					{working > 0 && (
						<span className="flex items-center gap-1.5 text-primary">
							<RadarStatusMark status="working" label={AGENT_RADAR_STATUS_LABELS.working} />
							<Text as="span" size="xs" className="tabular-nums text-primary">
								{working}
							</Text>
						</span>
					)}

					{waiting > 0 && (
						<span className="flex items-center gap-1.5 text-warning">
							<RadarStatusMark status="blocked" />
							<Text as="span" size="xs" className="tabular-nums text-warning">
								{waiting} esperando você
							</Text>
						</span>
					)}

					<Link
						to="/terminals"
						className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
					>
						Ver tudo
						<ArrowUpRight className="size-3" aria-hidden />
					</Link>
				</div>
			</header>

			<div className="overflow-x-auto">
				<div className="min-w-[48rem]">
					<div className={cn(COLUMNS, "border-b border-border bg-muted/30")} role="row">
						<span className={cn(CELL, HEADER_CELL)}>Agent</span>
						<span className={cn(CELL, HEADER_CELL)}>Status</span>
						<span className={cn(CELL, HEADER_CELL)}>Onde</span>
						<span className={cn(CELL, HEADER_CELL)}>Tarefa</span>
						<span className={cn(CELL, HEADER_CELL)}>Atualizado</span>
						<span className={cn(CELL, HEADER_CELL, "justify-end")}>Ações</span>
					</div>

					<ul className="divide-y divide-border">
						{sorted.map(function (agent) {
							const visual = AGENT_RADAR_VISUALS[agent.status];
							const paneId = agent.paneId;
							const taskId = agent.taskId;
							const agentLabel = agentRadarAgentLabel(agent.agent);

							return (
								<li key={paneId} className={cn("transition-colors", visual.surface)}>
									<ContextMenu>
										<ContextMenuTrigger asChild>
											<div className={cn(COLUMNS, "relative")}>
												<button
													type="button"
													onClick={function () {
														handleOpen(paneId);
													}}
													aria-label={`Abrir a conversa de ${agent.agent}`}
													className="absolute inset-0 cursor-pointer hover:bg-muted/20"
												/>

												<span
													className={cn(
														CELL,
														"pointer-events-none relative font-mono text-xs font-semibold uppercase tracking-[0.08em] text-foreground",
													)}
												>
													{agentLabel}
												</span>

												<span
													className={cn(
														CELL,
														"pointer-events-none relative gap-1.5 text-xs",
														visual.tone,
													)}
												>
													<RadarStatusMark status={agent.status} />
													<span className="truncate">
														{AGENT_RADAR_STATUS_LABELS[agent.status]}
													</span>
												</span>

												<span className={cn(CELL, "pointer-events-none relative")}>
													<Text as="span" size="xs" tone="muted" className="truncate font-mono">
														{agent.projectName ?? agent.cwd}
														<span className="text-muted-foreground/40"> · </span>
														{agent.tabLabel}
													</Text>
												</span>

												{taskId ? (
													<button
														type="button"
														onClick={function () {
															openTask(taskId, agent.projectId);
														}}
														aria-label={`Abrir tarefa ${agent.taskTitle ?? ""}`.trim()}
														className={cn(
															CELL,
															"relative z-10 w-full cursor-pointer text-left transition-colors hover:bg-muted/30 hover:text-foreground",
														)}
													>
														<Text as="span" size="xs" className="truncate text-foreground">
															{agent.taskTitle ?? "Tarefa vinculada"}
														</Text>
													</button>
												) : (
													<span className={cn(CELL, "pointer-events-none relative")}>
														<Text as="span" size="xs" tone="muted">
															—
														</Text>
													</span>
												)}

												<span className={cn(CELL, "pointer-events-none relative")}>
													<Text as="span" size="xs" tone="muted" className="truncate tabular-nums">
														{relativeTimeFrom(agent.changedAt)}
													</Text>
												</span>

												<div className={cn(CELL, "relative z-10 justify-end")}>
													<AgentNavButtons
														projectId={agent.projectId}
														projectName={agent.projectName}
														taskId={agent.taskId}
														taskTitle={agent.taskTitle}
														showOpenTask={false}
													/>
												</div>
											</div>
										</ContextMenuTrigger>

										<ContextMenuContent>
											<ContextMenuItem
												onSelect={function () {
													focus.mutate({ paneId });
												}}
											>
												<Target className="size-4" />
												Focar no kw-terminal
											</ContextMenuItem>

											<ContextMenuItem
												onSelect={function () {
													void navigate({ to: "/terminals/$paneId", params: { paneId } });
												}}
											>
												<MessagesSquare className="size-4" />
												Ver conversa
											</ContextMenuItem>

											{(agent.taskId || agent.projectId) && <ContextMenuSeparator />}

											<AgentNavMenuItems
												projectId={agent.projectId}
												projectName={agent.projectName}
												taskId={agent.taskId}
												taskTitle={agent.taskTitle}
											/>

											<ContextMenuSeparator />

											<ContextMenuItem
												onSelect={function () {
													diff.mutate({ paneId });
												}}
											>
												<GitCompare className="size-4" />
												Ver diff no kw-diff
											</ContextMenuItem>

											<ContextMenuItem
												onSelect={function () {
													close.mutate({ paneId });
												}}
												className="text-destructive"
											>
												<X className="size-4" />
												Fechar
											</ContextMenuItem>
										</ContextMenuContent>
									</ContextMenu>
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		</section>
	);
}
