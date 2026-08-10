import { useMutation } from "@tanstack/react-query";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, TerminalSquare } from "lucide-react";
import { useEffect } from "react";

import { orpc } from "@/client";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { PageShell } from "@/components/layout/page-shell";
import { TaskLink } from "@/components/task-link";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { permissionModeLabel } from "@/constants/execution";
import { useAgentSession } from "@/hooks/use-agent-session";
import { RunThread } from "../-components/run-thread";

export const Route = createLazyFileRoute("/_app/executar/$executionId/")({
	component: LegacyExecutionPage,
});

function LegacyExecutionPage() {
	const { executionId } = Route.useParams();
	const navigate = useNavigate();
	const { session, events, loading, missing, refetch } = useAgentSession(executionId);
	const resolveRun = useMutation({
		...orpc.agentSessions.resolveRun.mutationOptions(),
		onSuccess: async ({ sessionId }) => {
			if (sessionId) {
				await navigate({
					to: "/executar/$executionId",
					params: { executionId: sessionId },
					replace: true,
				});
			}
		},
	});
	const resolveLegacy = resolveRun.mutate;

	useEffect(() => {
		if (missing) {
			resolveLegacy({ sessionId: executionId });
		}
	}, [missing, executionId, resolveLegacy]);

	if (resolveRun.data?.runId && !resolveRun.data.sessionId) {
		return <RunThread runId={resolveRun.data.runId} />;
	}

	if (loading || (missing && resolveRun.isPending)) {
		return (
			<PageShell title="Arquivo de execução" description="Carregando…" icon={TerminalSquare}>
				<div className="flex min-h-64 items-center justify-center">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			</PageShell>
		);
	}

	if (!session) {
		return (
			<PageShell title="Execução não encontrada" icon={TerminalSquare}>
				<div className="border border-dashed border-border p-8 text-center">
					<Text tone="muted">Este registro não existe ou não está mais no arquivo.</Text>
					<div className="mt-4 flex justify-center gap-2">
						{!missing && (
							<Button variant="outline" onClick={() => void refetch()}>
								Tentar de novo
							</Button>
						)}
						<Button asChild variant="outline">
							<Link to="/terminals">Abrir nova conversa</Link>
						</Button>
					</div>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			title={session.taskTitle ?? session.title}
			description={`${session.projectName} · ${session.model ?? session.cli} · ${permissionModeLabel(session.permissionMode)} · arquivo somente leitura`}
			icon={TerminalSquare}
			contentClassName="min-h-0 overflow-y-auto"
			actions={
				<div className="flex flex-wrap items-center gap-2">
					{session.taskId && (
						<TaskLink taskId={session.taskId} label={session.taskTitle ?? "Abrir tarefa"} />
					)}
					<Button asChild size="sm">
						<Link to="/terminals">Abrir nova conversa</Link>
					</Button>
				</div>
			}
		>
			<div className="mx-auto w-full max-w-3xl pb-6">
				<SessionTimeline events={events} busy={false} agent={session.cli} />
			</div>
		</PageShell>
	);
}
