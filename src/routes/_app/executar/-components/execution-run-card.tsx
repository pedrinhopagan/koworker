import { Link } from "@tanstack/react-router";
import {
	Ban,
	ChevronRight,
	CircleCheck,
	CircleX,
	Clock3,
	Loader2,
	MessagesSquare,
	RotateCcw,
	TimerOff,
	type LucideIcon,
} from "lucide-react";

import { Text, Title } from "@/components/typography";
import { EXECUTION_STATUS_LABELS } from "@/constants/execution";
import { cn } from "@/lib/utils";
import type { Conversation } from "./conversations";
import { TaskLink } from "@/components/task-link";

type ExecutionStatus = keyof typeof EXECUTION_STATUS_LABELS;

const STATUS_TONES: Record<ExecutionStatus, string> = {
	running: "border-primary text-primary",
	done: "border-border text-foreground",
	failed: "border-destructive text-destructive",
	timeout: "border-warning text-warning",
	cancelled: "border-border text-muted-foreground",
};

const STATUS_ICONS: Record<ExecutionStatus, LucideIcon> = {
	running: Loader2,
	done: CircleCheck,
	failed: CircleX,
	timeout: TimerOff,
	cancelled: Ban,
};

const ACTION_CLASS =
	"inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function ExecutionRunCard({
	conversation,
	onRetry,
	onCancel,
	pending,
	active = false,
}: {
	conversation: Conversation;
	onRetry?: (runId: string) => void;
	onCancel?: (runId: string) => void;
	pending: boolean;
	active?: boolean;
}) {
	const run = conversation.latest;
	const running = run.status === "running";
	const StatusIcon = STATUS_ICONS[run.status];

	return (
		<article
			className={cn(
				"border border-border bg-card",
				active ? "shadow-[4px_4px_0_var(--primary)]" : "shadow-[2px_2px_0_var(--border)]",
			)}
		>
			<div className="flex items-start gap-3 border-b border-border p-3.5">
				<span
					className={cn(
						"mt-0.5 flex size-9 shrink-0 items-center justify-center border",
						running
							? "border-primary bg-primary text-primary-foreground"
							: STATUS_TONES[run.status],
					)}
				>
					<StatusIcon className={cn("size-4", running && "animate-spin")} />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<Title as="h3" size="sm" className="max-w-full truncate">
							{run.taskTitle ?? run.title}
						</Title>
						<span
							className={cn(
								"border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
								STATUS_TONES[run.status],
							)}
						>
							{EXECUTION_STATUS_LABELS[run.status]}
						</span>
						{conversation.turns > 1 && (
							<span className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
								<MessagesSquare className="size-3" />
								{conversation.turns} turnos
							</span>
						)}
					</div>
					<Text size="xs" tone="muted">
						{run.projectName} · {run.cli === "codex" ? "Codex" : "Claude"}
						{run.model && ` · ${run.model}`} · {new Date(run.startedAt).toLocaleString("pt-BR")}
					</Text>
				</div>
			</div>
			<div className="p-3.5">
				<Text className="line-clamp-2 text-sm">{run.originalPrompt ?? run.prompt}</Text>
				{run.error && <Text className="mt-3 text-sm text-destructive">{run.error}</Text>}
				<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
					<Text size="xs" tone="muted" className="flex items-center gap-1.5">
						<Clock3 className="size-3.5" />
						{run.finishedAt
							? `${Math.max(1, Math.round((run.finishedAt - run.startedAt) / 1000))}s`
							: "agora"}
					</Text>
					<div className="flex flex-wrap items-center gap-2">
						{run.taskId && <TaskLink taskId={run.taskId} label="Tarefa" />}
						{running && onCancel && (
							<button
								type="button"
								onClick={() => onCancel(run.runId)}
								disabled={pending}
								className={cn(
									ACTION_CLASS,
									"border-destructive text-destructive hover:bg-destructive hover:text-white",
								)}
							>
								<Ban className="size-3.5" />
								Interromper
							</button>
						)}
						{!running && onRetry && (
							<button
								type="button"
								onClick={() => onRetry(run.runId)}
								disabled={pending}
								className={cn(
									ACTION_CLASS,
									"border-border bg-muted/40 text-foreground hover:border-primary hover:bg-muted",
								)}
							>
								<RotateCcw className="size-3.5 text-primary" />
								Repetir
							</button>
						)}
						<Link
							to="/executar/$executionId"
							params={{ executionId: run.runId }}
							className={cn(
								ACTION_CLASS,
								"border-primary text-foreground hover:bg-primary hover:text-primary-foreground",
							)}
						>
							{conversation.turns > 1 ? "Abrir conversa" : "Abrir execução"}
							<ChevronRight className="size-3.5" />
						</Link>
					</div>
				</div>
			</div>
		</article>
	);
}
