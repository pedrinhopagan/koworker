import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, Loader2, RefreshCw, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { permissionModeLabel } from "@/constants/execution";
import { useAgentSession } from "@/hooks/use-agent-session";
import { errorMessage } from "@/lib/orpc-errors";
import { RunThread } from "../-components/run-thread";
import { SessionHeaderActions } from "../-components/session-header";
import { NewSessionHandoff } from "../-components/new-session-handoff";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { TaskLink } from "@/components/task-link";
import { ThreadComposer } from "@/components/agent-session/thread-composer";

export const Route = createLazyFileRoute("/_app/executar/$executionId/")({
	component: AgentSessionPage,
});

function AgentSessionPage() {
	const { executionId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const viewport = useRef<HTMLDivElement>(null);
	const [pinned, setPinned] = useState(true);

	const { session, events, status, busy, endReason, pending, loading, missing, refetch } =
		useAgentSession(executionId);

	// O mesmo endereço serve sessão e execução de chamada única (Codex e todo run anterior às
	// sessões): o id que não é sessão é resolvido aqui, virando redirect quando o run pertence a uma
	// sessão e a conversa antiga quando não pertence. Links e notificações já disparados continuam
	// valendo.
	const resolveRun = useMutation({
		...orpc.agentSessions.resolveRun.mutationOptions(),
		onSuccess: async ({ sessionId }) => {
			if (!sessionId) {
				return;
			}
			await navigate({
				to: "/executar/$executionId",
				params: { executionId: sessionId },
				replace: true,
			});
		},
	});
	const resolveLegacy = resolveRun.mutate;

	useEffect(() => {
		if (missing) {
			resolveLegacy({ sessionId: executionId });
		}
	}, [missing, executionId, resolveLegacy]);

	function reload() {
		return Promise.all([
			refetch(),
			queryClient.invalidateQueries({ queryKey: orpc.agentSessions.list.key() }),
		]);
	}

	const turn = useMutation({
		...orpc.agentSessions.turn.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível enviar a mensagem")),
	});
	const decide = useMutation({
		...orpc.agentSessions.permission.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível responder a permissão")),
	});
	const answer = useMutation({
		...orpc.agentSessions.answer.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível enviar a resposta")),
	});

	const scrollToEnd = useCallback(() => {
		viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
	}, []);

	// Acompanhar do celular significa ficar no fim da conversa enquanto o agente escreve, mas quem
	// subiu para reler não pode ser puxado de volta a cada bloco novo.
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
	}, [pinned, scrollToEnd, events.length, busy]);

	// Depois de todos os hooks: um retorno antes deles mudaria a quantidade de hooks entre renders.
	const legacyRunId = resolveRun.data?.sessionId ? null : resolveRun.data?.runId;
	if (legacyRunId) {
		return <RunThread runId={legacyRunId} />;
	}

	if (loading) {
		return (
			<PageShell title="Sessão" description="Carregando…" icon={TerminalSquare}>
				<div className="flex min-h-64 items-center justify-center">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			</PageShell>
		);
	}

	if (!session) {
		return (
			<PageShell
				title={missing ? "Sessão não encontrada" : "Sem conexão com o executor"}
				icon={TerminalSquare}
			>
				<div className="border border-dashed border-border p-8 text-center">
					<Text tone="muted">
						{missing
							? "Esta sessão não existe ou saiu do histórico."
							: "Não foi possível falar com o servidor agora. A sessão continua do outro lado — tente de novo em instantes."}
					</Text>
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						{!missing && (
							<Button variant="outline" onClick={() => void reload()}>
								<RefreshCw className="size-4" />
								Tentar de novo
							</Button>
						)}
						<Button asChild variant="outline">
							<Link to="/executar">Voltar ao histórico</Link>
						</Button>
					</div>
				</div>
			</PageShell>
		);
	}

	const live = status === "live";
	const composerHint = busy
		? "O agente está trabalhando. Assim que ele terminar você continua daqui."
		: "Responda ao agente acima para ele seguir.";

	return (
		<PageShell
			title={session.taskTitle ?? session.title}
			description={`${session.projectName} · ${session.model ?? session.cli} · ${permissionModeLabel(session.permissionMode)}`}
			icon={TerminalSquare}
			contentClassName="flex min-h-0 flex-col"
			actions={
				<div className="flex flex-wrap items-center gap-2">
					{live && (
						<SessionHeaderActions
							sessionId={session.id}
							cli={session.cli}
							busy={busy}
							permissionMode={session.permissionMode}
							onChanged={() => void reload()}
						/>
					)}
					{session.taskId && (
						<TaskLink taskId={session.taskId} label={session.taskTitle ?? "Abrir tarefa"} />
					)}
					<Button asChild variant="outline" size="sm">
						<Link to="/executar">
							<ArrowLeft className="size-4" />
							Histórico
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
					<SessionTimeline
						events={events}
						busy={busy}
						pending={decide.isPending || answer.isPending}
						onDecide={(requestId, decision, reason) =>
							decide.mutate({
								sessionId: session.id,
								requestId,
								decision,
								...(reason ? { reason } : {}),
							})
						}
						onAnswer={(questionId, input) =>
							answer.mutate({
								sessionId: session.id,
								questionId,
								answers: input.answers,
								...(input.freeText ? { freeText: input.freeText } : {}),
							})
						}
					/>
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

				{live ? (
					<ThreadComposer
						draftKey={`kowork-session-draft-${session.id}`}
						projectName={session.projectName}
						disabled={busy || !!pending}
						pending={turn.isPending}
						hint={composerHint}
						onSubmit={(prompt, inputKind) => {
							setPinned(true);
							turn.mutate({ sessionId: session.id, prompt, inputKind });
						}}
					/>
				) : (
					<NewSessionHandoff
						projectId={session.projectId}
						endReason={endReason}
						{...(session.taskId ? { taskId: session.taskId } : {})}
						{...(session.taskTitle ? { taskTitle: session.taskTitle } : {})}
					/>
				)}
			</div>
		</PageShell>
	);
}
