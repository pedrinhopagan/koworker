import { Check, ShieldQuestion, X } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgentEventPayloadOf } from "@/lib/agent-session";
import { cn } from "@/lib/utils";

export function SessionPermission({
	payload,
	pending,
	onDecide,
	readOnly = false,
}: {
	payload: AgentEventPayloadOf<"permission">;
	pending: boolean;
	onDecide: (decision: "allow" | "deny", reason?: string) => void;
	readOnly?: boolean;
}) {
	const [reason, setReason] = useState("");
	const [denying, setDenying] = useState(false);
	const decided = !!payload.decision;

	return (
		<section
			className={cn(
				"min-w-0 rounded-xl border border-border/70 bg-card p-3 shadow-sm md:p-4",
				!decided && "border-primary/60 ring-1 ring-primary/15",
			)}
		>
			<header className="flex flex-wrap items-center gap-2">
				<span
					className={cn(
						"flex size-7 shrink-0 items-center justify-center rounded-full bg-muted",
						!decided && "border-primary text-primary",
					)}
				>
					<ShieldQuestion className="size-3" />
				</span>
				<Text as="span" className="text-[11px] font-bold uppercase tracking-[0.12em]">
					{decided ? "Permissão respondida" : "O agente pede permissão"}
				</Text>
			</header>

			<Text className="mt-2 break-words text-[15px] leading-6">{payload.label}</Text>
			{payload.detail && (
				<Text className="mt-1 break-words font-mono text-[11px] leading-5 text-muted-foreground">
					{payload.detail}
				</Text>
			)}

			{decided ? (
				<Text size="xs" tone="muted" className="mt-3">
					{payload.decision === "allow" ? "Permitido por você." : "Negado por você."}
					{payload.reason ? ` ${payload.reason}` : ""}
				</Text>
			) : readOnly ? (
				<Text size="xs" tone="muted" className="mt-3">
					Responda no terminal para preservar a interação nativa do agent.
				</Text>
			) : (
				<div className="mt-3 space-y-2">
					{denying && (
						<Input
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Diga ao agente por que não (opcional)"
							autoFocus
						/>
					)}
					<div className="flex flex-wrap gap-2">
						<Button
							size="sm"
							disabled={pending}
							onClick={() => onDecide("allow")}
							className="min-w-28"
						>
							<Check className="size-4" />
							Permitir
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={pending}
							onClick={() => {
								if (!denying) {
									setDenying(true);
									return;
								}
								onDecide("deny", reason.trim() || undefined);
							}}
						>
							<X className="size-4" />
							{denying ? "Confirmar recusa" : "Negar"}
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
