import {
	Brain,
	Check,
	ChevronDown,
	CircleDot,
	Loader2,
	Terminal,
	TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { cn } from "@/lib/utils";
import { TOOL_ICONS } from "./tool-icons";

const COLLAPSED_ROWS = 4;
const THINKING_PREVIEW_CHARS = 220;

function TraceRow({ event }: { event: AgentSessionEvent }) {
	const [open, setOpen] = useState(false);
	const payload = event.payload;

	if (payload.kind === "thinking") {
		const long = payload.text.length > THINKING_PREVIEW_CHARS;

		return (
			<li className="flex min-w-0 gap-3 py-1.5">
				<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground">
					<Brain className="size-3" />
				</span>
				<button
					type="button"
					onClick={() => setOpen((current) => !current)}
					disabled={!long}
					className="min-w-0 flex-1 text-left"
				>
					<Text as="span" className="text-[11px] font-bold uppercase tracking-[0.1em]">
						Pensando
					</Text>
					<Text
						as="span"
						className={cn(
							"mt-0.5 block break-words text-xs leading-5 text-muted-foreground",
							!open && "line-clamp-2",
						)}
					>
						{payload.text}
					</Text>
				</button>
			</li>
		);
	}

	if (payload.kind === "notice") {
		const failed = payload.tone === "error";

		return (
			<li className="flex min-w-0 gap-3 py-1.5">
				<span
					className={cn(
						"mt-0.5 flex size-6 shrink-0 items-center justify-center border border-border bg-background",
						failed && "border-destructive text-destructive",
					)}
				>
					{failed ? <TriangleAlert className="size-3" /> : <CircleDot className="size-3" />}
				</span>
				<span className="min-w-0 flex-1">
					<Text
						as="span"
						className={cn(
							"text-[11px] font-bold uppercase tracking-[0.1em]",
							failed && "text-destructive",
						)}
					>
						{payload.label}
					</Text>
					{payload.detail && (
						<Text
							as="span"
							className="mt-0.5 block break-words text-xs leading-5 text-muted-foreground"
						>
							{payload.detail}
						</Text>
					)}
				</span>
			</li>
		);
	}

	if (payload.kind !== "tool_use") {
		return null;
	}

	const Icon = TOOL_ICONS[payload.label] ?? Terminal;
	const failed = payload.status === "error";

	return (
		<li className="flex min-w-0 gap-3 py-1.5">
			<span
				className={cn(
					"mt-0.5 flex size-6 shrink-0 items-center justify-center border border-border bg-background",
					failed && "border-destructive text-destructive",
					payload.status === "running" && "border-primary text-primary",
				)}
			>
				{payload.status === "running" ? (
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
						{payload.label}
					</Text>
					{payload.status === "ok" && <Check className="size-3 shrink-0 text-muted-foreground" />}
				</span>
				{payload.detail && (
					<Text
						as="span"
						className="mt-0.5 block break-words font-mono text-[11px] leading-5 text-muted-foreground"
					>
						{payload.detail}
					</Text>
				)}
			</span>
		</li>
	);
}

// O caminho que o agente percorreu entre uma fala e outra: pensamento, ferramenta, aviso. Fica
// recolhido porque o que importa na conversa é a fala; o rastro é para quando algo dá errado.
export function SessionTrace({ events }: { events: AgentSessionEvent[] }) {
	const [expanded, setExpanded] = useState(false);
	const hidden = expanded ? 0 : Math.max(0, events.length - COLLAPSED_ROWS);
	const visible = hidden > 0 ? events.slice(-COLLAPSED_ROWS) : events;

	return (
		<div className="min-w-0 border border-border bg-muted/20">
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
				{visible.map((event) => (
					<TraceRow key={event.seq} event={event} />
				))}
			</ul>
		</div>
	);
}
