import { Bot, CircleCheck, Loader2, TriangleAlert } from "lucide-react";

import { Text } from "@/components/typography";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { cn } from "@/lib/utils";
import { AgentAnswer } from "./agent-answer";
import { SessionPermission } from "./session-permission";
import { SessionQuestion } from "./session-question";
import { SessionTrace } from "./session-trace";
import { SessionUserMessage } from "./session-user-message";

const TRACE_KINDS = new Set(["thinking", "tool_use", "notice"]);

type Group =
	| { kind: "trace"; key: string; events: AgentSessionEvent[] }
	| { kind: "block"; key: string; event: AgentSessionEvent };

// Pensamento, ferramenta e aviso viram um rastro só entre duas falas: a conversa lida de cima a
// baixo é a fala, e o caminho até ela fica recolhido logo acima de onde importou.
function toGroups(events: AgentSessionEvent[]): Group[] {
	const groups: Group[] = [];

	for (const event of events) {
		if (!TRACE_KINDS.has(event.payload.kind)) {
			groups.push({ kind: "block", key: String(event.seq), event });
			continue;
		}

		const last = groups.at(-1);
		if (last?.kind === "trace") {
			last.events.push(event);
			continue;
		}

		groups.push({ kind: "trace", key: `trace-${event.seq}`, events: [event] });
	}

	return groups;
}

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

export function SessionTimeline({
	events,
	busy,
	pending,
	onDecide,
	onAnswer,
}: {
	events: AgentSessionEvent[];
	busy: boolean;
	pending?: boolean;
	// Ausentes quando a conversa é só leitura, como a de um agent do terminal: o pedido continua
	// visível, mas quem responde é quem está na frente do CLI.
	onDecide?: (requestId: string, decision: "allow" | "deny", reason?: string) => void;
	onAnswer?: (questionId: string, input: { answers: string[]; freeText?: string }) => void;
}) {
	const groups = toGroups(events);

	return (
		<div className="min-w-0 space-y-4">
			{groups.map((group) => {
				if (group.kind === "trace") {
					return <SessionTrace key={group.key} events={group.events} />;
				}

				const { payload } = group.event;

				if (payload.kind === "user") {
					return <SessionUserMessage key={group.key} text={payload.text} />;
				}

				if (payload.kind === "assistant") {
					return (
						<section
							key={group.key}
							className="min-w-0 border border-border bg-card p-3 shadow-[3px_3px_0_var(--border)] md:p-4"
						>
							<header className="mb-2 flex items-center gap-2">
								<span className="flex size-6 shrink-0 items-center justify-center border border-border bg-muted/40">
									<Bot className="size-3" />
								</span>
								<Text as="span" className="text-[11px] font-bold uppercase tracking-[0.12em]">
									Agente
								</Text>
							</header>
							<AgentAnswer runId={group.event.id} output={payload.text} />
						</section>
					);
				}

				if (payload.kind === "permission") {
					return (
						<SessionPermission
							key={group.key}
							payload={payload}
							pending={!!pending || !onDecide}
							onDecide={(decision, reason) => onDecide?.(payload.requestId, decision, reason)}
						/>
					);
				}

				if (payload.kind === "question") {
					return (
						<SessionQuestion
							key={group.key}
							payload={payload}
							pending={!!pending || !onAnswer}
							onAnswer={(input) => onAnswer?.(payload.questionId, input)}
						/>
					);
				}

				return <ResultRow key={group.key} event={group.event} />;
			})}

			{busy && (
				<div
					className={cn(
						"flex items-center gap-2 border border-dashed border-primary px-3 py-3",
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
