import { ChevronDown, Layers, Route } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { trailStepLabel, type TrailStep } from "@/lib/agent-timeline";
import { cn } from "@/lib/utils";
import { TOOL_ICONS } from "./tool-icons";
import { TraceLabel, TraceShell } from "./trace-primitives";
import { TraceRow } from "./trace-row";

const SUMMARY_LABELS = 3;

// Passo repetido não vira dez linhas iguais: uma linha com a contagem, que se abre no lugar quando
// alguém quer ver cada um.
function RepeatRow({ label, events }: { label: string; events: AgentSessionEvent[] }) {
	const [open, setOpen] = useState(false);

	if (open) {
		return (
			<>
				{events.map((event) => (
					<TraceRow key={event.seq} event={event} />
				))}
			</>
		);
	}

	return (
		<TraceShell icon={TOOL_ICONS[label] ?? Layers}>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex w-full min-w-0 cursor-pointer items-center gap-2 text-left"
			>
				<TraceLabel>{label}</TraceLabel>
				<Text as="span" className="font-mono text-[11px] text-muted-foreground">
					×{events.length}
				</Text>
				<ChevronDown className="size-3 shrink-0 text-muted-foreground" />
			</button>
		</TraceShell>
	);
}

// O que mais apareceu no rastro, para o cabeçalho dizer do que ele é feito sem ninguém abrir.
function summarize(steps: TrailStep[]) {
	const counts = new Map<string, number>();

	for (const step of steps) {
		const events = step.kind === "repeat" ? step.events : [step.event];
		for (const event of events) {
			const label = trailStepLabel(event);
			counts.set(label, (counts.get(label) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.sort((left, right) => right[1] - left[1])
		.slice(0, SUMMARY_LABELS)
		.map(([label, count]) => (count > 1 ? `${label} ×${count}` : label))
		.join(" · ");
}

// O caminho que o agente percorreu entre uma fala e outra. Fica fechado com o passo mais recente à
// vista: acompanhar é ver o que ele está fazendo agora, não reler tudo o que já fez.
export function SessionTrace({ steps, total }: { steps: TrailStep[]; total: number }) {
	const [open, setOpen] = useState(false);
	const last = steps.at(-1);
	const hidden = steps.length - 1;

	function render(step: TrailStep) {
		return step.kind === "repeat" ? (
			<RepeatRow key={step.key} label={step.label} events={step.events} />
		) : (
			<TraceRow key={step.key} event={step.event} />
		);
	}

	return (
		<div className="min-w-0 border border-border bg-muted/20">
			{hidden > 0 && (
				<button
					type="button"
					onClick={() => setOpen((current) => !current)}
					className="flex w-full cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<Route className="size-3.5 shrink-0 text-muted-foreground" />
					<Text as="span" size="xs" tone="muted" className="shrink-0 font-mono">
						{total} passos
					</Text>
					<Text as="span" size="xs" tone="muted" className="min-w-0 flex-1 truncate">
						{summarize(steps)}
					</Text>
					<ChevronDown
						className={cn(
							"size-3.5 shrink-0 text-muted-foreground transition-transform",
							open && "rotate-180",
						)}
					/>
				</button>
			)}

			<ul
				className={cn(
					"min-w-0 px-3 py-1.5",
					open && "max-h-[60vh] overflow-y-auto overscroll-contain",
				)}
			>
				{open ? steps.map(render) : last && render(last)}
			</ul>
		</div>
	);
}
