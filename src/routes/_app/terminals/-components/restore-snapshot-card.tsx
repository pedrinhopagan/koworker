import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, PlayCircle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { AGENT_RADAR_STATUS_LABELS, type AgentRadarStatus } from "@/constants/agent-radar";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { errorMessage } from "@/lib/orpc-errors";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

function statusVisual(status: string) {
	return AGENT_RADAR_VISUALS[status as AgentRadarStatus] ?? AGENT_RADAR_VISUALS.unknown;
}

function statusLabel(status: string) {
	return AGENT_RADAR_STATUS_LABELS[status as AgentRadarStatus] ?? status;
}

// O que estava aberto na última vez que a máquina foi desligada. Só aparece quando não há agent vivo:
// com o kw-terminal de pé o retrato é passado, e oferecer restauração ali só duplicaria sessão.
export function RestoreSnapshotCard({ hasLiveAgents }: { hasLiveAgents: boolean }) {
	const queryClient = useQueryClient();
	const snapshot = useQuery(orpc.agentRadar.snapshot.queryOptions());
	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: orpc.agentRadar.snapshot.key() });
		void queryClient.invalidateQueries({ queryKey: orpc.kwTerminal.overview.key() });
	};

	const restore = useMutation({
		...orpc.agentRadar.restoreSnapshot.mutationOptions(),
		onSuccess: (result) => {
			toast.success(
				result.continued > 0
					? `${result.restored} sessão(ões) restaurada(s); ${result.continued} recebeu "continue"`
					: `${result.restored} sessão(ões) restaurada(s)`,
			);
			invalidate();
		},
		onError: (error: Error) => toast.error(errorMessage(error, "Falha ao restaurar as sessões")),
	});

	const discard = useMutation({
		...orpc.agentRadar.discardSnapshot.mutationOptions(),
		onSuccess: invalidate,
		onError: (error: Error) => toast.error(errorMessage(error, "Falha ao descartar o retrato")),
	});

	const sessions = snapshot.data?.sessions ?? [];
	const busy = restore.isPending || discard.isPending;

	if (hasLiveAgents || sessions.length === 0) {
		return null;
	}

	return (
		<section className="border border-border bg-card shadow-[3px_3px_0_var(--border)]">
			<header className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
				<History className="size-4 shrink-0 text-muted-foreground" aria-hidden />

				<Title as="h2" size="xs" className="uppercase tracking-[0.14em]">
					Sessões da última vez
				</Title>

				{snapshot.data?.capturedAt && (
					<Text size="xs" tone="muted" className="ml-auto shrink-0 tabular-nums">
						{relativeTimeFrom(snapshot.data.capturedAt)}
					</Text>
				)}
			</header>

			<ul className="divide-y divide-border">
				{sessions.map((session) => {
					const visual = statusVisual(session.status);

					return (
						<li key={session.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
							<span className="font-mono text-sm font-semibold uppercase tracking-[0.08em]">
								{session.agent}
							</span>

							<span
								className={cn(
									"inline-flex shrink-0 items-center border px-2 py-0.5 text-xs font-semibold",
									visual.badge,
								)}
							>
								{statusLabel(session.status)}
							</span>

							{session.status === "working" && (
								<span className="inline-flex shrink-0 items-center gap-1 border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
									<PlayCircle className="size-3" aria-hidden />
									vai continuar
								</span>
							)}

							<Text size="xs" tone="muted" className="w-full break-all font-mono">
								{session.projectName ?? session.cwd} · {session.tabLabel}
								{!session.resumable && " · sem id de sessão, retoma a última do diretório"}
							</Text>
						</li>
					);
				})}
			</ul>

			<footer className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
				<Button size="sm" disabled={busy} onClick={() => restore.mutate({})}>
					<RotateCcw className="size-4" />
					Restaurar sessões
				</Button>

				<Button
					size="sm"
					variant="ghost"
					disabled={busy}
					onClick={() => discard.mutate({})}
					className="text-muted-foreground"
				>
					<Trash2 className="size-4" />
					Descartar
				</Button>

				<Text size="xs" tone="muted" className="ml-auto">
					Abre o kw-terminal com cada agent retomando a conversa de antes.
				</Text>
			</footer>
		</section>
	);
}
