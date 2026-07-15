import { Link } from "@tanstack/react-router";
import { Ban, Clock3, Loader2, RotateCcw, TerminalSquare } from "lucide-react";

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
}: {
	run: Run;
	onRetry: (runId: string) => void;
	onCancel: (runId: string) => void;
	pending: boolean;
}) {
	const running = run.status === "running";

	return (
		<article className="border border-border bg-card shadow-[3px_3px_0_var(--border)]">
			<div className="flex items-start gap-3 border-b border-border p-3">
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
						<Title as="h3" size="sm" className="truncate">
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
				{running ? (
					<Button
						size="icon"
						variant="outline"
						onClick={() => onCancel(run.runId)}
						disabled={pending}
						aria-label="Cancelar execução"
					>
						<Ban className="size-4" />
					</Button>
				) : (
					<Button
						size="icon"
						variant="outline"
						onClick={() => onRetry(run.runId)}
						disabled={pending}
						aria-label="Repetir execução"
					>
						<RotateCcw className="size-4" />
					</Button>
				)}
			</div>
			<div className="p-3">
				<Text className="line-clamp-2 text-sm">{run.originalPrompt ?? run.prompt}</Text>
				{run.output && (
					<pre className="mt-3 max-h-52 overflow-auto border-l-2 border-primary bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
						{run.output}
					</pre>
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
