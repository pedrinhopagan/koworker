import {
	Brain,
	Check,
	ChevronDown,
	CircleDot,
	Loader2,
	MessageSquare,
	Terminal,
	TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { TOOL_ICONS } from "@/components/agent-session/tool-icons";
import { Text } from "@/components/typography";
import type { AgentStep } from "@/lib/agent-stream";
import { cn } from "@/lib/utils";

const COLLAPSED_STEPS = 4;

function stepIcon(step: AgentStep) {
	if (step.kind === "thinking") {
		return Brain;
	}
	if (step.kind === "message") {
		return MessageSquare;
	}
	if (step.kind === "notice") {
		return step.status === "error" ? TriangleAlert : CircleDot;
	}

	return TOOL_ICONS[step.label] ?? Terminal;
}

function StepRow({ step }: { step: AgentStep }) {
	const Icon = stepIcon(step);
	const failed = step.status === "error";

	return (
		<li className="relative flex min-w-0 gap-3 py-1.5">
			<span
				className={cn(
					"mt-0.5 flex size-6 shrink-0 items-center justify-center border border-border bg-background",
					failed && "border-destructive text-destructive",
					step.status === "running" && "border-primary text-primary",
				)}
			>
				{step.status === "running" ? (
					<Loader2 className="size-3 animate-spin" />
				) : (
					<Icon className="size-3" />
				)}
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-2">
					<Text
						as="span"
						className={cn(
							"text-[11px] font-bold uppercase tracking-[0.1em]",
							failed && "text-destructive",
						)}
					>
						{step.label}
					</Text>
					{step.status === "ok" && step.kind === "tool" && (
						<Check className="size-3 shrink-0 text-muted-foreground" />
					)}
				</span>
				{step.detail && (
					<Text
						as="span"
						className={cn(
							"mt-0.5 block break-words text-xs leading-5 text-muted-foreground",
							step.kind === "tool" && "font-mono text-[11px]",
							step.kind === "message" && "text-foreground",
						)}
					>
						{step.detail}
					</Text>
				)}
			</span>
		</li>
	);
}

export function AgentSteps({ steps, running }: { steps: AgentStep[]; running: boolean }) {
	const [expanded, setExpanded] = useState(false);

	if (steps.length === 0) {
		return running ? (
			<div className="flex items-center gap-2 border border-dashed border-border px-3 py-3">
				<Loader2 className="size-3.5 animate-spin text-primary" />
				<Text size="xs" tone="muted">
					Aguardando o primeiro movimento do agente…
				</Text>
			</div>
		) : null;
	}

	const hidden = expanded ? 0 : Math.max(0, steps.length - COLLAPSED_STEPS);
	const visible = hidden > 0 ? steps.slice(-COLLAPSED_STEPS) : steps;

	return (
		<div className="border border-border bg-muted/20">
			{hidden > 0 && (
				<button
					type="button"
					onClick={() => setExpanded(true)}
					className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<Text as="span" size="xs" tone="muted">
						{hidden === 1 ? "Mostrar o passo anterior" : `Mostrar os ${hidden} passos anteriores`}
					</Text>
					<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
				</button>
			)}
			<ul className="min-w-0 px-3 py-1.5">
				{visible.map((step) => (
					<StepRow key={step.seq} step={step} />
				))}
			</ul>
		</div>
	);
}
