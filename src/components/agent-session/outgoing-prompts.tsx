import { Clock, ListOrdered, Loader2, SquareTerminal, TriangleAlert, X } from "lucide-react";

import { MarkdownView } from "@/components/markdown-view";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import type { OutgoingPrompt } from "@/lib/agent-prompt-receipt";
import { cn } from "@/lib/utils";

const STATES = {
	queued: { icon: ListOrdered, label: "Na fila do agente", tone: "text-primary" },
	waiting: {
		icon: Clock,
		label: "Aguardando o agente terminar o passo atual",
		tone: "text-primary",
	},
	sending: { icon: Loader2, label: "Enviando…", tone: "text-muted-foreground" },
	unconfirmed: {
		icon: TriangleAlert,
		label: "O agente ainda não registrou esta mensagem",
		tone: "text-warning",
	},
} as const;

export function OutgoingPrompts({
	items,
	queueHint,
	onDismiss,
	onOpenTerminal,
}: {
	items: OutgoingPrompt[];
	queueHint: string | null;
	onDismiss: (pendingId: string) => void;
	onOpenTerminal?: () => void;
}) {
	if (items.length === 0) {
		return null;
	}

	return (
		<div data-component="outgoing-prompts" className="space-y-2">
			{items.map((item) => {
				const state = STATES[item.state];

				return (
					<div key={item.key} className="flex justify-end">
						<div
							className={cn(
								"min-w-0 max-w-[92%] rounded-xl rounded-br-sm border border-dashed border-primary/40 bg-primary/5 px-3.5 py-2.5 sm:max-w-[80%]",
								item.state === "unconfirmed" && "border-warning/60 bg-warning/5",
							)}
						>
							<MarkdownView text={item.text} className="text-[15px] opacity-80" />
							<div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
								<state.icon
									className={cn(
										"size-3.5 shrink-0",
										state.tone,
										item.state === "sending" && "animate-spin",
									)}
								/>
								<Text as="span" size="xs" className={cn("font-semibold", state.tone)}>
									{state.label}
								</Text>
								{(item.state === "queued" || item.state === "waiting") && queueHint && (
									<Text as="span" size="xs" tone="muted">
										· {queueHint}
									</Text>
								)}
								{item.state === "unconfirmed" && onOpenTerminal && (
									<Button variant="outline" size="sm" className="h-7" onClick={onOpenTerminal}>
										<SquareTerminal className="size-3.5" />
										Conferir no terminal
									</Button>
								)}
								{item.pendingId && item.state !== "sending" && (
									<Button
										variant="ghost"
										size="sm"
										className="h-7 text-muted-foreground"
										onClick={() => onDismiss(item.pendingId!)}
									>
										<X className="size-3.5" />
										Ocultar
									</Button>
								)}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
