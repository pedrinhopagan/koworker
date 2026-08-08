import { useMutation } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowLeft,
	Loader2,
	MoreVertical,
	Square,
	SquareTerminal,
	Target,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { AgentSidebar } from "@/components/agent-radar/agent-sidebar";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { ThreadComposer } from "@/components/agent-session/thread-composer";
import { PageShell } from "@/components/layout/page-shell";
import { TaskLink } from "@/components/task-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useAgentRadarTranscript } from "@/hooks/use-agent-radar-transcript";
import { errorMessage } from "@/lib/orpc-errors";
import { PaneStatusStrip } from "../-components/pane-status-strip";

export const Route = createLazyFileRoute("/_app/terminals/$paneId/")({
	component: TerminalPanePage,
});

function TerminalPanePage() {
	const { paneId } = Route.useParams();
	const viewport = useRef<HTMLDivElement>(null);
	const [pinned, setPinned] = useState(true);
	const { agents, loading: radarLoading } = useAgentRadar();
	const agent = agents.find((candidate) => candidate.paneId === paneId) ?? null;
	const transcript = useAgentRadarTranscript(paneId);
	const closed = !agent && !radarLoading;
	const busy = agent?.status === "working";
	const blocked = agent?.status === "blocked";

	const send = useMutation({
		...orpc.agentRadar.send.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível responder ao agent")),
	});
	const interrupt = useMutation({
		...orpc.agentRadar.interrupt.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível interromper o agent")),
	});
	const focus = useMutation({
		...orpc.agentRadar.focus.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível focar o agent")),
	});
	const close = useMutation({
		...orpc.agentRadar.close.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível fechar o agent")),
	});
	const syncTranscript = useMutation({
		...orpc.agentRadar.syncTranscript.mutationOptions(),
		onSuccess: ({ found }) => {
			if (!found) {
				toast.info("Nenhuma conversa foi encontrada para este agent");
			}
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível sincronizar a conversa")),
	});

	const scrollToEnd = useCallback(() => {
		viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
	}, []);

	useEffect(() => {
		const node = viewport.current;
		if (!node || !pinned) {
			return;
		}

		scrollToEnd();
		const observer = new ResizeObserver(() => scrollToEnd());
		observer.observe(node);
		for (const child of node.children) {
			observer.observe(child);
		}
		window.visualViewport?.addEventListener("resize", scrollToEnd);

		return () => {
			observer.disconnect();
			window.visualViewport?.removeEventListener("resize", scrollToEnd);
		};
	}, [pinned, scrollToEnd, transcript.events.length]);

	return (
		<PageShell
			title={agent?.title ?? agent?.agent ?? "Agent"}
			description="A central mostra apenas agents abertos"
			icon={SquareTerminal}
			headerClassName="mb-0"
			contentClassName="flex min-h-0 max-w-none flex-col px-0"
			actions={
				<div className="flex flex-wrap items-center gap-2">
					{agent && (
						<Badge variant={blocked ? "warning" : "muted"}>
							{AGENT_RADAR_STATUS_LABELS[agent.status]}
						</Badge>
					)}
					{agent?.taskId && <TaskLink taskId={agent.taskId} label={agent.taskTitle ?? "Tarefa"} />}
					{busy && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => interrupt.mutate({ paneId })}
							disabled={interrupt.isPending}
						>
							<Square className="size-3.5" />
							Interromper
						</Button>
					)}
					{blocked && (
						<Button variant="outline" size="sm" onClick={() => focus.mutate({ paneId })}>
							<Target className="size-3.5" />
							Responder no terminal
						</Button>
					)}
					<Button asChild variant="outline" size="sm" className="md:hidden">
						<Link to="/terminals">
							<ArrowLeft className="size-4" />
							Agents
						</Link>
					</Button>
					{agent && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" aria-label="Mais ações">
									<MoreVertical className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => focus.mutate({ paneId })}>
									<Target className="size-4" />
									Focar no terminal
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => close.mutate({ paneId })}
									className="text-destructive"
								>
									Fechar
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			}
		>
			<div data-component="terminal-conversation-layout" className="flex min-h-0 flex-1">
				<div className="hidden md:flex">
					<AgentSidebar agents={agents} selectedPaneId={paneId} />
				</div>

				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
					<PaneStatusStrip agent={agent} closed={closed} />

					<div
						ref={viewport}
						onScroll={(event) => {
							const node = event.currentTarget;
							setPinned(node.scrollHeight - node.scrollTop - node.clientHeight < 120);
						}}
						className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
					>
						<div className="mx-auto w-full max-w-3xl space-y-5 pb-4 pt-5">
							{transcript.loading && !closed && (
								<div className="flex min-h-32 items-center justify-center">
									<Loader2 className="size-5 animate-spin text-muted-foreground" />
								</div>
							)}

							{((!transcript.loading && transcript.missing) || closed) && (
								<EmptyFeedback
									icon={SquareTerminal}
									title={closed ? "Pane fechado" : "Comece a conversa"}
									subtitle={
										closed
											? "A central encerrou envio e transcript deste pane."
											: "Envie a primeira mensagem abaixo. Se a sessão já existia, sincronize o histórico."
									}
									{...(!closed && {
										actionText: syncTranscript.isPending
											? "Sincronizando..."
											: "Sincronizar conversa",
										actionPending: syncTranscript.isPending,
										onAction: () => syncTranscript.mutate({ paneId }),
									})}
								/>
							)}

							{!closed &&
								!transcript.loading &&
								!transcript.missing &&
								transcript.events.length === 0 && (
									<EmptyFeedback
										icon={SquareTerminal}
										title="Conversa vazia"
										subtitle="A primeira fala aparecerá quando o transcript nativo registrá-la."
									/>
								)}

							{!closed && <SessionTimeline events={transcript.events} busy={!!busy} />}
						</div>
					</div>

					{!pinned && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setPinned(true);
								scrollToEnd();
							}}
							className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 bg-background"
						>
							<ArrowDown className="size-4" />
							Ir para o fim
						</Button>
					)}

					<div className="mx-auto w-full max-w-3xl px-4">
						<ThreadComposer
							draftKey={`kowork-radar-draft-${paneId}`}
							{...(agent?.projectName ? { projectName: agent.projectName } : {})}
							disabled={closed || !!busy || !!blocked}
							pending={send.isPending}
							hint={
								closed
									? "Este pane foi fechado."
									: busy
										? "Interrompa ou aguarde o agent terminar."
										: blocked
											? "Responda ao pedido nativo no terminal."
											: "Envie uma mensagem para iniciar a conversa."
							}
							onSubmit={async (text) => {
								setPinned(true);
								try {
									await send.mutateAsync({ paneId, text });
									return true;
								} catch {
									return false;
								}
							}}
						/>
					</div>
				</div>
			</div>
		</PageShell>
	);
}
