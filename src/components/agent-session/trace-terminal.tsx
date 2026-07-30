import { Check, ChevronDown, Terminal, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import type { AgentEventPayloadOf } from "@/lib/agent-session";
import { commandLabel } from "@/lib/shell-command";
import { cn } from "@/lib/utils";
import { TraceLabel, TraceShell, toneOf } from "./trace-primitives";

// O terminal do agente é o passo mais barulhento do rastro: comando com pipe, heredoc e flag que
// ocupa dez linhas. Colapsado, a linha diz só qual programa está rodando (`agent-browser`, `bun
// test`); aberto, o comando inteiro fica em uma caixa com rolagem própria.
export function TraceTerminal({ payload }: { payload: AgentEventPayloadOf<"tool_use"> }) {
	const [open, setOpen] = useState(false);
	const command = payload.detail ?? "";
	const program = commandLabel(command);
	const running = payload.status === "running";
	const failed = payload.status === "error";

	return (
		<TraceShell
			icon={failed ? TriangleAlert : Terminal}
			spinning={running}
			tone={toneOf(payload.status)}
		>
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				disabled={!command}
				className="flex w-full min-w-0 cursor-pointer items-center gap-2 text-left disabled:cursor-default"
			>
				<TraceLabel tone={failed ? "error" : undefined}>Terminal</TraceLabel>

				<Text
					as="span"
					className={cn(
						"min-w-0 flex-1 truncate font-mono text-[11px] leading-5",
						running ? "text-primary" : "text-muted-foreground",
					)}
				>
					{program ?? "comando"}
					{running && " · rodando"}
				</Text>

				{payload.status === "ok" && <Check className="size-3 shrink-0 text-muted-foreground" />}

				{command && (
					<ChevronDown
						className={cn(
							"size-3 shrink-0 text-muted-foreground transition-transform",
							open && "rotate-180",
						)}
					/>
				)}
			</button>

			{open && command && (
				<pre className="mt-1.5 max-h-64 overflow-auto overscroll-contain border border-border bg-background p-2 font-mono text-[11px] leading-5 text-muted-foreground">
					{command}
				</pre>
			)}
		</TraceShell>
	);
}
