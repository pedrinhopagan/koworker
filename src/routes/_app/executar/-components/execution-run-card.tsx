import { Link } from "@tanstack/react-router";
import { Ban, ChevronRight, Clock3, Loader2, RotateCcw, TerminalSquare } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Run = RouterOutputs["prompt"]["listRuns"][number];

const STATUS_LABELS = {
	running: "Em execução",
	done: "Concluída",
	failed: "Falhou",
	timeout: "Tempo esgotado",
	cancelled: "Cancelada",
} as const;

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
							{STATUS_LABELS[run.status]}
						</span>
					</div>
					<Text size="xs" tone="muted">
						{run.projectName} · {new Date(run.startedAt).toLocaleString("pt-BR")}
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
				{run.output && active && (
					<pre className="mt-3 max-h-52 overflow-auto border-l-2 border-primary bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
						{run.output}
					</pre>
				)}
				{run.output && !active && (
					<details className="group mt-3 border-l-2 border-border bg-muted/30">
						<summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
							Ver resultado
							<ChevronRight className="size-4 transition-transform group-open:rotate-90" />
						</summary>
						<pre className="max-h-52 overflow-auto border-t border-border p-3 font-mono text-xs whitespace-pre-wrap">
							{run.output}
						</pre>
					</details>
				)}
				{run.error && <Text className="mt-3 text-sm text-destructive">{run.error}</Text>}
				<div className="mt-3 flex items-center justify-between gap-3">
					<Text size="xs" tone="muted" className="flex items-center gap-1">
						<Clock3 className="size-3" />
						{run.finishedAt
							? `${Math.max(1, Math.round((run.finishedAt - run.startedAt) / 1000))}s`
							: "agora"}
					</Text>
					{run.taskId && (
						<Link
							to="/tarefas/$taskId"
							params={{ taskId: run.taskId }}
							className="text-xs font-bold text-primary hover:underline"
						>
							Abrir tarefa
						</Link>
					)}
				</div>
			</div>
		</article>
	);
}
