import { Ban, Bot, Loader2, RotateCcw, TriangleAlert, User } from "lucide-react";
import { useEffect, useState } from "react";

import type { RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EXECUTION_STATUS_LABELS } from "@/constants/execution";
import { useRunStream } from "@/hooks/use-run-stream";
import { mergeAgentSteps } from "@/lib/agent-stream";
import { cn } from "@/lib/utils";
import { AgentAnswer } from "@/components/agent-session/agent-answer";
import { AgentSteps } from "./agent-steps";

type Turn = RouterOutputs["prompt"]["thread"]["turns"][number];

function elapsedLabel(ms: number) {
	const seconds = Math.max(0, Math.round(ms / 1000));
	if (seconds < 60) {
		return `${seconds}s`;
	}

	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function useElapsed(startedAt: number, running: boolean) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!running) {
			return;
		}
		const timer = setInterval(() => setNow(Date.now()), 1000);

		return () => clearInterval(timer);
	}, [running]);

	return now - startedAt;
}

export function ExecutionTurn({
	turn,
	index,
	onCancel,
	onRetry,
	pending,
}: {
	turn: Turn;
	index: number;
	onCancel?: () => void;
	onRetry?: () => void;
	pending: boolean;
}) {
	const running = turn.status === "running";
	const liveSteps = useRunStream({ runId: turn.runId, enabled: running });
	const steps = mergeAgentSteps(turn.steps, liveSteps);
	const elapsed = useElapsed(turn.startedAt, running);
	const duration = turn.finishedAt ? turn.finishedAt - turn.startedAt : elapsed;
	const failed = turn.status === "failed" || turn.status === "timeout";

	return (
		<article className="min-w-0 space-y-3">
			<div className="flex justify-end">
				<div className="flex min-w-0 max-w-[92%] items-start gap-2 border border-border bg-muted/40 px-3 py-2 sm:max-w-[80%]">
					<User className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
					<Text className="min-w-0 whitespace-pre-wrap break-words text-[15px] leading-6">
						{turn.originalPrompt ?? turn.prompt}
					</Text>
				</div>
			</div>

			<section
				className={cn(
					"min-w-0 rounded-xl border border-border/70 bg-card p-3 shadow-sm md:p-4",
					running && "border-primary/60 ring-1 ring-primary/15",
					failed && "border-destructive",
				)}
			>
				<header className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-2">
					<span
						className={cn(
							"flex size-7 shrink-0 items-center justify-center rounded-full bg-muted",
							running && "border-primary text-primary",
							failed && "border-destructive text-destructive",
						)}
					>
						{running ? (
							<Loader2 className="size-3 animate-spin" />
						) : failed ? (
							<TriangleAlert className="size-3" />
						) : (
							<Bot className="size-3" />
						)}
					</span>
					<Text as="span" className="text-[11px] font-bold uppercase tracking-[0.12em]">
						Turno {index + 1}
					</Text>
					<Text as="span" size="xs" tone="muted">
						{EXECUTION_STATUS_LABELS[turn.status]} · {elapsedLabel(duration)}
					</Text>
					{running && onCancel && (
						<Button
							variant="outline"
							size="sm"
							onClick={onCancel}
							disabled={pending}
							className="ml-auto"
						>
							<Ban className="size-3.5" />
							Interromper
						</Button>
					)}
					{failed && onRetry && (
						<Button
							variant="outline"
							size="sm"
							onClick={onRetry}
							disabled={pending}
							className="ml-auto"
						>
							<RotateCcw className="size-3.5" />
							Repetir
						</Button>
					)}
				</header>

				<AgentSteps steps={steps} running={running} />

				{turn.error && (
					<div className="mt-3 border-l-2 border-destructive bg-destructive/5 p-3">
						<Text className="text-sm text-destructive">{turn.error}</Text>
					</div>
				)}

				{turn.output && (
					<div className="mt-3 border-t border-border pt-3">
						<AgentAnswer runId={turn.runId} output={turn.output} />
					</div>
				)}

				{!turn.output && !turn.error && !running && (
					<Text size="xs" tone="muted" className="mt-3">
						O agente terminou sem escrever uma resposta final.
					</Text>
				)}
			</section>
		</article>
	);
}
