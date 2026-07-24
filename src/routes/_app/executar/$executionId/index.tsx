import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Ban,
	Clock3,
	Loader2,
	RefreshCw,
	RotateCcw,
	TerminalSquare,
} from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EXECUTION_STATUS_LABELS } from "@/constants/execution";
import { newClientRequestId } from "@/lib/client-request-id";
import { isNotFoundError } from "@/lib/orpc-errors";
import { cn } from "@/lib/utils";
import { ExecutionContinuation } from "../-components/execution-continuation";
import { ExecutionResult } from "../-components/execution-result";

export const Route = createFileRoute("/_app/executar/$executionId/")({
	component: ExecutionDetailPage,
});

function ExecutionDetailPage() {
	const { executionId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const runQuery = useQuery({
		...orpc.prompt.runStatus.queryOptions({ input: { runId: executionId } }),
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
	const continueMutation = useMutation({
		...orpc.prompt.continue.mutationOptions(),
		onSuccess: async ({ runId }) => {
			localStorage.removeItem(`kowork-execution-followup-${executionId}`);
			await queryClient.invalidateQueries({ queryKey: orpc.prompt.listRuns.key() });
			toast.success("Sessão continuada");
			await navigate({ to: "/executar/$executionId", params: { executionId: runId } });
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const retryMutation = useMutation({
		...orpc.prompt.retry.mutationOptions(),
		onSuccess: ({ runId }) => {
			void navigate({ to: "/executar/$executionId", params: { executionId: runId } });
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const cancelMutation = useMutation({
		...orpc.prompt.cancel.mutationOptions(),
		onSuccess: () => void runQuery.refetch(),
		onError: (error: Error) => toast.error(error.message),
	});

	if (runQuery.isLoading) {
		return (
			<PageShell title="Execução" description="Carregando resultado…" icon={TerminalSquare}>
				<div className="flex min-h-64 items-center justify-center">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			</PageShell>
		);
	}

	if (!runQuery.data) {
		const missing = isNotFoundError(runQuery.error);

		return (
			<PageShell
				title={missing ? "Execução não encontrada" : "Sem conexão com o executor"}
				icon={TerminalSquare}
			>
				<div className="border border-dashed border-border p-8 text-center">
					<Text tone="muted">
						{missing
							? "Este resultado não existe ou não está mais no histórico."
							: "Não foi possível falar com o servidor agora. A execução continua do outro lado — tente de novo em instantes."}
					</Text>
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						{!missing && (
							<Button variant="outline" onClick={() => void runQuery.refetch()}>
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

	const run = runQuery.data;
	const running = run.status === "running";
	const duration = run.finishedAt
		? Math.max(1, Math.round((run.finishedAt - run.startedAt) / 1000))
		: null;

	return (
		<PageShell
			title={run.taskTitle ?? run.title}
			description={`${run.projectName} · ${run.cli === "codex" ? "Codex" : "Claude"}${run.model ? ` · ${run.model}` : ""}`}
			icon={TerminalSquare}
			contentClassName="overflow-y-auto pb-24"
			actions={
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="sm">
						<Link to="/executar">
							<ArrowLeft className="size-4" />
							Histórico
						</Link>
					</Button>
					{running ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => cancelMutation.mutate({ runId: run.runId })}
							disabled={cancelMutation.isPending}
						>
							<Ban className="size-4" />
							Cancelar
						</Button>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								retryMutation.mutate({ runId: run.runId, clientRequestId: newClientRequestId() })
							}
							disabled={retryMutation.isPending}
						>
							<RotateCcw className="size-4" />
							Repetir
						</Button>
					)}
				</div>
			}
		>
			<div className="grid gap-6 pb-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
				<div className="min-w-0 space-y-6">
					<div className="flex flex-wrap items-center gap-2 border-y border-border py-2">
						<span
							className={cn(
								"border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
								running && "border-primary text-primary",
								run.status === "failed" && "border-destructive text-destructive",
							)}
						>
							{EXECUTION_STATUS_LABELS[run.status]}
						</span>
						<Text size="xs" tone="muted" className="flex items-center gap-1">
							<Clock3 className="size-3" />
							{duration ? `${duration}s` : "Em andamento"}
						</Text>
						{run.parentRunId && (
							<Link
								to="/executar/$executionId"
								params={{ executionId: run.parentRunId }}
								className="text-xs font-bold text-primary hover:underline"
							>
								Ver turno anterior
							</Link>
						)}
					</div>

					<ExecutionResult runId={run.runId} output={run.output} />

					{run.canContinue && (
						<ExecutionContinuation
							cli={run.cli ?? "claude"}
							model={run.model}
							pending={continueMutation.isPending}
							draftKey={`kowork-execution-followup-${executionId}`}
							onSubmit={(prompt, inputKind) =>
								continueMutation.mutate({
									runId: run.runId,
									clientRequestId: newClientRequestId(),
									prompt,
									inputKind,
								})
							}
						/>
					)}
				</div>

				<aside className="border border-border bg-muted/20 p-4 lg:sticky lg:top-4">
					<Title as="h2" size="xs" className="uppercase tracking-[0.12em]">
						Instrução original
					</Title>
					<Text className="mt-3 whitespace-pre-wrap text-sm leading-6">
						{run.originalPrompt ?? run.prompt}
					</Text>
					{run.error && (
						<div className="mt-4 border-l-2 border-destructive bg-destructive/5 p-3">
							<Text className="text-sm text-destructive">{run.error}</Text>
						</div>
					)}
					{run.taskId && (
						<Button asChild variant="outline" size="sm" className="mt-4 w-full">
							<Link to="/tarefas/$taskId" params={{ taskId: run.taskId }}>
								Abrir tarefa
							</Link>
						</Button>
					)}
				</aside>
			</div>
		</PageShell>
	);
}
