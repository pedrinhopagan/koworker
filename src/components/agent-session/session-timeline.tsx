import { Bot, CircleCheck, CircleDot, Loader2, TriangleAlert } from "lucide-react";
import { memo, useMemo } from "react";

import { agentCliVisual } from "@/components/agent-radar/agent-cli";
import { Text } from "@/components/typography";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { toTimelineGroups, type TimelineGroup, type TrailStep } from "@/lib/agent-timeline";
import { cn } from "@/lib/utils";
import { AgentAnswer } from "./agent-answer";
import { SessionPermission } from "./session-permission";
import { SessionQuestion } from "./session-question";
import { SessionTrace } from "./session-trace";
import { SessionUserMessage } from "./session-user-message";

function ResultRow({ event }: { event: AgentSessionEvent }) {
	if (event.payload.kind !== "result") {
		return null;
	}

	const failed = event.payload.status !== "done";
	const seconds = event.payload.durationMs ? Math.round(event.payload.durationMs / 1000) : null;

	return (
		<div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-2">
			{failed ? (
				<TriangleAlert className="size-3.5 shrink-0 text-destructive" />
			) : (
				<CircleCheck className="size-3.5 shrink-0 text-muted-foreground" />
			)}
			<Text as="span" size="xs" tone="muted">
				{failed ? "Turno interrompido" : "Turno concluído"}
				{seconds === null ? "" : ` · ${seconds}s`}
				{event.payload.costUsd ? ` · US$ ${event.payload.costUsd.toFixed(3)}` : ""}
			</Text>
			{event.payload.error && (
				<Text as="span" size="xs" className="text-destructive">
					{event.payload.error}
				</Text>
			)}
		</div>
	);
}

type GroupProps = {
	group: TimelineGroup;
	agent?: string;
	pending?: boolean;
	onDecide?: (requestId: string, decision: "allow" | "deny", reason?: string) => void;
	onAnswer?: (questionId: string, input: { answers: string[]; freeText?: string }) => void;
};

// O espelho da conversa preserva a identidade de cada evento entre lotes, então comparar por
// referência basta: um bloco novo não redesenha os que já estavam na tela.
function sameSteps(left: TrailStep[], right: TrailStep[]) {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((step, index) => {
		const other = right[index];
		if (!other || step.kind !== other.kind || step.key !== other.key) {
			return false;
		}

		if (step.kind === "step" && other.kind === "step") {
			return step.event === other.event;
		}

		return (
			step.kind === "repeat" &&
			other.kind === "repeat" &&
			step.events.length === other.events.length &&
			step.events.every((event, position) => event === other.events[position])
		);
	});
}

function sameGroup(left: GroupProps, right: GroupProps) {
	if (
		left.agent !== right.agent ||
		left.pending !== right.pending ||
		left.onDecide !== right.onDecide ||
		left.onAnswer !== right.onAnswer ||
		left.group.kind !== right.group.kind ||
		left.group.key !== right.group.key
	) {
		return false;
	}

	if (left.group.kind === "trail" && right.group.kind === "trail") {
		return left.group.total === right.group.total && sameSteps(left.group.steps, right.group.steps);
	}

	return left.group.kind === "block" && right.group.kind === "block"
		? left.group.event === right.group.event
		: false;
}

const TimelineGroupView = memo(function TimelineGroupView({
	group,
	agent,
	pending,
	onDecide,
	onAnswer,
}: GroupProps) {
	if (group.kind === "trail") {
		return <SessionTrace steps={group.steps} total={group.total} />;
	}

	const { payload } = group.event;
	const cli = agent ? agentCliVisual(agent) : null;

	if (payload.kind === "user") {
		return <SessionUserMessage text={payload.text} />;
	}

	if (payload.kind === "assistant") {
		return (
			<section className="min-w-0 rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm md:p-4">
				<header className="mb-2 flex items-center gap-2">
					<span
						className={cn(
							"flex size-7 shrink-0 items-center justify-center rounded-full",
							cli ? cn("bg-muted", cli.tone) : "bg-primary/10 text-primary",
						)}
					>
						{cli ? <cli.icon className="size-3.5" /> : <Bot className="size-3" />}
					</span>
					<Text
						as="span"
						className={cn("text-[11px] font-bold", !cli && "uppercase tracking-[0.12em]")}
					>
						{cli?.label ?? "Agente"}
					</Text>
				</header>
				<AgentAnswer
					runId={group.event.id}
					output={payload.text}
					meta={{
						...(agent ? { agent } : {}),
						at: group.event.at,
						seq: group.event.seq,
					}}
				/>
			</section>
		);
	}

	if (payload.kind === "permission") {
		return (
			<SessionPermission
				payload={payload}
				pending={!!pending || !onDecide}
				readOnly={!onDecide}
				onDecide={(decision, reason) => onDecide?.(payload.requestId, decision, reason)}
			/>
		);
	}

	if (payload.kind === "question") {
		return (
			<SessionQuestion
				payload={payload}
				pending={!!pending || !onAnswer}
				readOnly={!onAnswer}
				onAnswer={(input) => onAnswer?.(payload.questionId, input)}
			/>
		);
	}

	if (payload.kind === "notice") {
		return (
			<div className="flex items-start gap-2 px-1 py-2">
				<CircleDot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
				<div className="min-w-0">
					<Text as="span" size="xs" className="font-bold">
						{payload.label}
					</Text>
					{payload.detail && (
						<Text size="xs" tone="muted">
							{payload.detail}
						</Text>
					)}
				</div>
			</div>
		);
	}

	return <ResultRow event={group.event} />;
}, sameGroup);

export function SessionTimeline({
	events,
	busy,
	agent,
	pending,
	onDecide,
	onAnswer,
}: {
	events: AgentSessionEvent[];
	busy: boolean;
	// Slug da CLI que responde nesta conversa. Sem ele o bloco cai no rótulo genérico "Agente".
	agent?: string;
	pending?: boolean;
	// Ausentes quando a conversa é só leitura, como a de um agent do terminal: o pedido continua
	// visível, mas quem responde é quem está na frente do CLI.
	onDecide?: (requestId: string, decision: "allow" | "deny", reason?: string) => void;
	onAnswer?: (questionId: string, input: { answers: string[]; freeText?: string }) => void;
}) {
	const groups = useMemo(() => toTimelineGroups(events), [events]);

	return (
		<div className="min-w-0 space-y-4">
			{groups.map((group) => (
				<TimelineGroupView
					key={group.key}
					group={group}
					{...(agent ? { agent } : {})}
					{...(pending === undefined ? {} : { pending })}
					{...(onDecide ? { onDecide } : {})}
					{...(onAnswer ? { onAnswer } : {})}
				/>
			))}

			{busy && (
				<div
					className={cn(
						"flex items-center gap-2 rounded-lg bg-primary/8 px-3 py-2.5",
						"text-primary",
					)}
				>
					<Loader2 className="size-3.5 animate-spin" />
					<Text size="xs" tone="muted">
						O agente está trabalhando…
					</Text>
				</div>
			)}
		</div>
	);
}
