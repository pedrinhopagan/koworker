import { Check, ChevronDown, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

import { Text } from "@/components/typography";
import { StatusMark } from "@/components/ui/status-mark";
import { formatElapsedSeconds, useElapsedSeconds } from "@/hooks/use-elapsed-seconds";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { trailStepLabel } from "@/lib/agent-timeline";
import { cn } from "@/lib/utils";

const THOUGHT_LINE_STEPS = 3;

function currentTurn(events: AgentSessionEvent[]) {
	const lastUser = events.findLastIndex((event) => event.payload.kind === "user");
	const turn = events.slice(Math.max(0, lastUser));
	const result = turn.findLast((event) => event.payload.kind === "result")?.payload;
	const steps = turn
		.filter((event) => event.payload.kind === "tool_use")
		.slice(-THOUGHT_LINE_STEPS)
		.map((event) => ({
			seq: event.seq,
			label: trailStepLabel(event),
			detail:
				event.payload.kind === "tool_use" &&
				event.payload.label !== "Terminal" &&
				event.payload.detail,
			status: event.payload.kind === "tool_use" && event.payload.status,
		}));

	return {
		startedAt: lastUser >= 0 && !result ? events[lastUser]?.at : undefined,
		outcome: result?.kind === "result" ? result.status : "done",
		steps,
	};
}

export function ThoughtLine({
	events,
	working,
}: {
	events: AgentSessionEvent[];
	working: boolean;
}) {
	const reduce = useReducedMotion();
	const turn = useMemo(() => currentTurn(events), [events]);
	const [startedAt, setStartedAt] = useState<number | null>(null);
	const seconds = useElapsedSeconds(startedAt, working);
	const [wasWorking, setWasWorking] = useState(false);
	const [settled, setSettled] = useState<number | null>(null);
	const [open, setOpen] = useState(true);

	if (working !== wasWorking) {
		setWasWorking(working);
		setOpen(working);
		setSettled(working ? null : (seconds ?? 0));
		if (working) {
			setStartedAt(turn.startedAt ?? Date.now());
		}
	}

	if (!working && settled === null) {
		return null;
	}

	const toggle = !working && turn.steps.length > 0;
	const shownSeconds = working ? seconds : settled;

	return (
		<div data-component="thought-line" data-working={working || undefined} className="min-w-0 px-1">
			<button
				type="button"
				disabled={!toggle}
				aria-expanded={toggle ? open : undefined}
				onClick={() => setOpen((current) => !current)}
				className="flex min-w-0 items-center gap-2 rounded-sm text-left enabled:cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<StatusMark status={working ? "running" : turn.outcome} />
				<Text as="span" size="xs" role="status" className="flex items-center gap-1.5 font-medium">
					{working && (
						<motion.span
							className="bg-[linear-gradient(100deg,var(--color-muted-foreground)_30%,var(--color-foreground)_50%,var(--color-muted-foreground)_70%)] bg-size-[250%_100%] bg-clip-text text-transparent"
							initial={{ backgroundPosition: "125% 0" }}
							animate={reduce ? { backgroundPosition: "50% 0" } : { backgroundPosition: "-125% 0" }}
							transition={
								reduce ? { duration: 0 } : { duration: 1.8, ease: "linear", repeat: Infinity }
							}
						>
							Trabalhando
						</motion.span>
					)}
					{!working && <span className="text-muted-foreground">Pensou por</span>}
					{shownSeconds !== null && (
						<span className="text-muted-foreground tabular-nums">
							{formatElapsedSeconds(shownSeconds)}
						</span>
					)}
				</Text>
				{toggle && (
					<ChevronDown
						className={cn(
							"size-3 shrink-0 text-muted-foreground transition-transform duration-200",
							open && "rotate-180",
						)}
					/>
				)}
			</button>

			{turn.steps.length > 0 && (
				<div
					aria-hidden={!open}
					className={cn(
						"grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
						open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
					)}
				>
					<ul className="min-h-0 space-y-1 overflow-hidden pl-[22px]">
						{turn.steps.map((step, index) => {
							const active =
								working && index === turn.steps.length - 1 && step.status === "running";

							return (
								<motion.li
									key={step.seq}
									className="flex min-w-0 items-center gap-2 pt-1 text-muted-foreground"
									initial={reduce ? false : { opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
								>
									<span className="grid size-3 shrink-0 place-items-center">
										{active && (
											<span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
										)}
										{!active && step.status === "error" && (
											<X className="size-3 text-destructive" />
										)}
										{!active && step.status !== "error" && <Check className="size-3 opacity-60" />}
									</span>
									<Text as="span" size="xs" className="shrink-0 font-medium">
										{step.label}
									</Text>
									{step.detail && (
										<Text
											as="span"
											size="xs"
											className="min-w-0 truncate font-mono text-[11px] opacity-70"
										>
											{step.detail}
										</Text>
									)}
								</motion.li>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
}
