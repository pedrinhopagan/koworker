import { useMutation } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, Loader2, SquareTerminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { ThreadComposer } from "@/components/agent-session/thread-composer";
import { PageShell } from "@/components/layout/page-shell";
import { TaskLink } from "@/components/task-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useAgentRadarTranscript } from "@/hooks/use-agent-radar-transcript";
import { errorMessage } from "@/lib/orpc-errors";

export const Route = createLazyFileRoute("/_app/terminals/$paneId/")({
	component: TerminalPanePage,
});

function TerminalPanePage() {
	const { paneId } = Route.useParams();
	const viewport = useRef<HTMLDivElement>(null);
	const [pinned, setPinned] = useState(true);

	const { agents, loading: radarLoading } = useAgentRadar();
	const agent = agents.find((candidate) => candidate.paneId === paneId) ?? null;
	const { events, source, missing, loading } = useAgentRadarTranscript(paneId);

	const send = useMutation({
		...orpc.agentRadar.send.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível responder ao agent")),
	});

	const scrollToEnd = useCallback(() => {
		viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
	}, []);

	// Acompanhar do celular é ficar no fim da conversa enquanto o agent escreve, sem puxar de volta
	// quem subiu para reler.
	useEffect(() => {
		const node = viewport.current;
		if (!node || !pinned) {
			return;
		}

		scrollToEnd();
		const observer = new ResizeObserver(() => scrollToEnd());
		for (const child of node.children) {
			observer.observe(child);
		}

		return () => observer.disconnect();
	}, [pinned, scrollToEnd, events.length]);

	const busy = agent?.status === "working";
	const closed = !agent && !radarLoading;

	return (
		<PageShell
			title={agent?.title ?? agent?.agent ?? "Agent"}
			description={[agent?.projectName ?? agent?.cwd, agent?.tabLabel, source?.cli]
				.filter(Boolean)
				.join(" · ")}
			icon={SquareTerminal}
			contentClassName="flex min-h-0 flex-col"
			actions={
				<div className="flex flex-wrap items-center gap-2">
					{agent && (
						<Badge variant={agent.status === "blocked" ? "warning" : "muted"}>
							{AGENT_RADAR_STATUS_LABELS[agent.status]}
						</Badge>
					)}

					{agent?.taskId && <TaskLink taskId={agent.taskId} label={agent.taskTitle ?? "Tarefa"} />}

					<Button asChild variant="outline" size="sm">
						<Link to="/terminals">
							<ArrowLeft className="size-4" />
							Terminais
						</Link>
					</Button>
				</div>
			}
		>
			<div className="relative flex min-h-0 flex-1 flex-col">
				<div
					ref={viewport}
					onScroll={(event) => {
						const node = event.currentTarget;
						setPinned(node.scrollHeight - node.scrollTop - node.clientHeight < 120);
					}}
					className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-4"
				>
					{loading && (
						<div className="flex min-h-32 items-center justify-center">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					)}

					{!loading && missing && (
						<EmptyFeedback
							icon={SquareTerminal}
							title="Sem conversa para ler"
							subtitle="Este agent não grava sessão em disco, ou ainda não escreveu a primeira linha."
						/>
					)}

					{!loading && !missing && events.length === 0 && (
						<EmptyFeedback
							icon={SquareTerminal}
							title="Conversa vazia"
							subtitle="A sessão começou agora: o que for dito aqui aparece sozinho."
						/>
					)}

					<SessionTimeline events={events} busy={busy} />
				</div>

				{!pinned && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setPinned(true);
							scrollToEnd();
						}}
						className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 bg-background shadow-[3px_3px_0_var(--border)]"
					>
						<ArrowDown className="size-4" />
						Ir para o fim
					</Button>
				)}

				<ThreadComposer
					draftKey={`kowork-radar-draft-${paneId}`}
					{...(agent?.projectName ? { projectName: agent.projectName } : {})}
					disabled={closed}
					pending={send.isPending}
					hint={
						closed
							? "Este agent não está mais aberto no terminal."
							: "O texto vai para o prompt do agent no terminal e o Enter é dado por aqui."
					}
					onSubmit={(text) => {
						setPinned(true);
						send.mutate({ paneId, text });
					}}
				/>
			</div>
		</PageShell>
	);
}
