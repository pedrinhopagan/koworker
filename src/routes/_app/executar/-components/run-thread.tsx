import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, TerminalSquare } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { newClientRequestId } from "@/lib/client-request-id";
import { errorMessage, isNotFoundError } from "@/lib/orpc-errors";
import { ExecutionTurn } from "./execution-turn";
import { TaskLink } from "@/components/task-link";

// Execução de chamada única: o Codex e todo run anterior às sessões. Continua sendo uma sequência de
// turnos independentes ligados pelo id de sessão do CLI — o composer aqui dispara um run novo, não
// escreve num processo de pé.
export function RunThread({ runId }: { runId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const threadQuery = useQuery({
		...orpc.prompt.thread.queryOptions({ input: { runId } }),
		retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
		refetchInterval: (query) => {
			if (isNotFoundError(query.state.error)) {
				return false;
			}
			if (!query.state.data || query.state.data.status === "running") {
				return 2500;
			}

			return false;
		},
	});

	const thread = threadQuery.data;
	const job = thread?.turns.every(
		(turn) => turn.source === "merge_action" || turn.source === "automation",
	);

	async function refreshThread() {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.prompt.thread.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.prompt.listRuns.key() }),
		]);
	}

	const retryMutation = useMutation({
		...orpc.prompt.retry.mutationOptions(),
		onSuccess: async ({ runId: next }) => {
			await refreshThread();
			await navigate({ to: "/executar/$executionId", params: { executionId: next } });
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível repetir a execução")),
	});
	const cancelMutation = useMutation({
		...orpc.prompt.cancel.mutationOptions(),
		onSuccess: () => void refreshThread(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível interromper a execução")),
	});

	if (threadQuery.isLoading) {
		return (
			<PageShell title="Arquivo de execução" description="Carregando…" icon={TerminalSquare}>
				<div className="flex min-h-64 items-center justify-center">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			</PageShell>
		);
	}

	if (!thread) {
		return (
			<PageShell title="Execução não encontrada" icon={TerminalSquare}>
				<div className="border border-dashed border-border p-8 text-center">
					<Text tone="muted">Esta conversa não existe ou não está mais no histórico.</Text>
					<div className="mt-4 flex justify-center">
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
			title={thread.taskTitle ?? thread.title}
			description={`${thread.projectName} · ${thread.cli === "codex" ? "Codex" : "Claude"} · ${job ? "job" : "arquivo legado somente leitura"}`}
			icon={TerminalSquare}
			contentClassName="flex min-h-0 flex-col"
			actions={
				<div className="flex flex-wrap items-center gap-2">
					{thread.taskId && (
						<TaskLink taskId={thread.taskId} label={thread.taskTitle ?? "Tarefa"} />
					)}
					<Button asChild variant="outline" size="sm">
						<Link to="/terminals">
							<ArrowLeft className="size-4" />
							Agents
						</Link>
					</Button>
				</div>
			}
		>
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-4">
					{thread.turns.map((turn, index) => (
						<ExecutionTurn
							key={turn.runId}
							turn={turn}
							index={index}
							pending={cancelMutation.isPending || retryMutation.isPending}
							{...(job
								? {
										onCancel: () => cancelMutation.mutate({ runId: turn.runId }),
										onRetry: () =>
											retryMutation.mutate({
												runId: turn.runId,
												clientRequestId: newClientRequestId(),
											}),
									}
								: {})}
						/>
					))}
				</div>
			</div>
		</PageShell>
	);
}
