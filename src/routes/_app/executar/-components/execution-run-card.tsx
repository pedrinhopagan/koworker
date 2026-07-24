import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Ban, Clock3, Loader2, RotateCcw, TerminalSquare } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EXECUTION_STATUS_LABELS } from "@/constants/execution";
import { cn } from "@/lib/utils";

type Run = RouterOutputs["prompt"]["listRuns"][number];

export function ExecutionRunCard({
	run,
	onRetry,
	onCancel,
	pending,
	active = false,
}: {
	run: Run;
	onRetry?: (runId: string) => void;
	onCancel?: (runId: string) => void;
	pending: boolean;
	active?: boolean;
}) {
	const running = run.status === "running";

	return (
		<article
			className={cn(
				"border border-border bg-card",
				active ? "shadow-[4px_4px_0_var(--primary)]" : "shadow-[2px_2px_0_var(--border)]",
			)}
		>
			<div className="flex items-start gap-3 border-b border-border p-3.5">
				<div
					className={cn(
						"mt-0.5 flex size-8 items-center justify-center border border-border",
						running && "bg-primary text-primary-foreground",
					)}
				>
					{running ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<TerminalSquare className="size-4" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<Title as="h3" size="sm" className="max-w-full truncate">
							{run.taskTitle ?? run.title}
						</Title>
						<span
							className={cn(
								"border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
								running && "border-primary text-primary",
							)}
						>
							{EXECUTION_STATUS_LABELS[run.status]}
						</span>
					</div>
					<Text size="xs" tone="muted">
						{run.projectName} · {run.cli === "codex" ? "Codex" : "Claude"}
						{run.model && ` · ${run.model}`} · {new Date(run.startedAt).toLocaleString("pt-BR")}
					</Text>
				</div>
				{running && onCancel ? (
					<Button
						size="sm"
						variant="outline"
						onClick={() => onCancel(run.runId)}
						disabled={pending}
						aria-label="Cancelar execução"
					>
						<Ban className="size-4" />
						<span className="hidden sm:inline">Cancelar</span>
					</Button>
				) : onRetry ? (
					<Button
						size="icon"
						variant="outline"
						onClick={() => onRetry(run.runId)}
						disabled={pending}
						aria-label="Repetir execução"
					>
						<RotateCcw className="size-4" />
					</Button>
				) : null}
			</div>
			<div className="p-3.5">
				<Text className="line-clamp-2 text-sm">{run.originalPrompt ?? run.prompt}</Text>
				{run.error && <Text className="mt-3 text-sm text-destructive">{run.error}</Text>}
				<div className="mt-3 flex items-center justify-between gap-3">
					<Text size="xs" tone="muted" className="flex items-center gap-1">
						<Clock3 className="size-3" />
						{run.finishedAt
							? `${Math.max(1, Math.round((run.finishedAt - run.startedAt) / 1000))}s`
							: "agora"}
					</Text>
					<div className="flex items-center gap-3">
						{run.taskId && (
							<Link
								to="/tarefas/$taskId"
								params={{ taskId: run.taskId }}
								className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
							>
								Tarefa
							</Link>
						)}
						<Link
							to="/executar/$executionId"
							params={{ executionId: run.runId }}
							className="inline-flex min-h-9 items-center gap-1 border border-border px-2.5 text-xs font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							Abrir execução
							<ArrowUpRight className="size-3.5" />
						</Link>
					</div>
				</div>
			</div>
		</article>
	);
}
