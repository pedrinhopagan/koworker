import {
	Brain,
	Check,
	CircleDot,
	ChevronDown,
	MessageSquare,
	Terminal,
	TriangleAlert,
	type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { TRAIL_LABELS } from "@/lib/agent-timeline";
import { cn } from "@/lib/utils";
import { TOOL_ICONS } from "./tool-icons";
import { TraceLabel, TraceShell, toneOf } from "./trace-primitives";
import { TraceTerminal } from "./trace-terminal";

const PREVIEW_CHARS = 160;

// Pensamento e narração são o mesmo problema: texto longo que ninguém quer inteiro na conversa, mas
// que precisa estar acessível. Duas linhas por padrão; aberto, uma caixa com rolagem própria.
function LongTextRow({ icon, label, text }: { icon: LucideIcon; label: string; text: string }) {
	const [open, setOpen] = useState(false);
	const long = text.length > PREVIEW_CHARS;

	return (
		<TraceShell icon={icon}>
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				disabled={!long}
				className="w-full min-w-0 cursor-pointer text-left disabled:cursor-default"
			>
				<span className="flex items-center gap-1.5">
					<TraceLabel>{label}</TraceLabel>
					{long && (
						<ChevronDown
							className={cn(
								"size-3 shrink-0 text-muted-foreground transition-transform",
								open && "rotate-180",
							)}
						/>
					)}
				</span>
				<Text
					as="span"
					className={cn(
						"mt-0.5 block break-words text-xs leading-5 text-muted-foreground",
						open
							? "max-h-64 overflow-y-auto overscroll-contain whitespace-pre-wrap"
							: "line-clamp-2",
					)}
				>
					{text}
				</Text>
			</button>
		</TraceShell>
	);
}

export function TraceRow({ event }: { event: AgentSessionEvent }) {
	const { payload } = event;

	if (payload.kind === "thinking") {
		return <LongTextRow icon={Brain} label={TRAIL_LABELS.thinking} text={payload.text} />;
	}

	if (payload.kind === "assistant") {
		return <LongTextRow icon={MessageSquare} label={TRAIL_LABELS.assistant} text={payload.text} />;
	}

	if (payload.kind === "notice") {
		const failed = payload.tone === "error";

		return (
			<TraceShell icon={failed ? TriangleAlert : CircleDot} tone={failed ? "error" : undefined}>
				<TraceLabel tone={failed ? "error" : undefined}>{payload.label}</TraceLabel>
				{payload.detail && (
					<Text
						as="span"
						className="mt-0.5 block break-words text-xs leading-5 text-muted-foreground"
					>
						{payload.detail}
					</Text>
				)}
			</TraceShell>
		);
	}

	if (payload.kind !== "tool_use") {
		return null;
	}

	if (payload.label === "Terminal") {
		return <TraceTerminal payload={payload} />;
	}

	const Icon = TOOL_ICONS[payload.label] ?? Terminal;
	const failed = payload.status === "error";
	const running = payload.status === "running";

	return (
		<TraceShell icon={Icon} spinning={running} tone={toneOf(payload.status)}>
			<span className="flex items-center gap-2">
				<TraceLabel tone={failed ? "error" : undefined}>{payload.label}</TraceLabel>
				{payload.status === "ok" && <Check className="size-3 shrink-0 text-muted-foreground" />}
			</span>
			{payload.detail && (
				<Text
					as="span"
					className="mt-0.5 block truncate font-mono text-[11px] leading-5 text-muted-foreground"
				>
					{payload.detail}
				</Text>
			)}
		</TraceShell>
	);
}
