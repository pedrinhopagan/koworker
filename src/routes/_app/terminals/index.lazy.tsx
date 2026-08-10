import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, RotateCcw, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { AgentSidebar } from "@/components/agent-radar/agent-sidebar";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { errorMessage } from "@/lib/orpc-errors";
import { NewSessionDialog } from "./-components/new-session-dialog";

export const Route = createLazyFileRoute("/_app/terminals/")({
	component: TerminalsPage,
});

function TerminalsPage() {
	const [creating, setCreating] = useState(false);
	const queryClient = useQueryClient();
	const { agents, focus, loading: radarLoading } = useAgentRadar();
	const savedTerminals = useQuery({
		...orpc.agentRadar.savedTerminals.queryOptions(),
		enabled: !radarLoading && agents.length === 0,
	});
	const reopen = useMutation({
		...orpc.agentRadar.reopenSavedTerminals.mutationOptions(),
		onSuccess: async (result) => {
			const restoredLabel =
				result.restored === 1 ? "1 terminal reaberto" : `${result.restored} terminais reabertos`;

			if (result.failed > 0) {
				const failedLabel = result.failed === 1 ? "1 falhou" : `${result.failed} falharam`;
				toast.warning(`${restoredLabel}; ${failedLabel}`);
			} else {
				toast.success(restoredLabel);
			}

			await queryClient.invalidateQueries({
				queryKey: orpc.agentRadar.savedTerminals.key(),
			});
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível reabrir os terminais")),
	});
	const canReopen = !radarLoading && agents.length === 0 && (savedTerminals.data?.count ?? 0) > 0;

	return (
		<PageShell
			title="Agents"
			description="A central mostra apenas agents abertos"
			icon={SquareTerminal}
			headerClassName="mb-0"
			contentClassName="flex min-h-0 max-w-none flex-col px-0"
			actions={
				<>
					{canReopen && (
						<Button
							variant="outline"
							size="sm"
							disabled={reopen.isPending}
							aria-busy={reopen.isPending}
							onClick={() => reopen.mutate({})}
						>
							{reopen.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<RotateCcw className="size-4" />
							)}
							{reopen.isPending ? "Reabrindo..." : "Reabrir terminais"}
						</Button>
					)}

					<Button
						size="sm"
						onClick={function () {
							setCreating(true);
						}}
					>
						<Plus className="size-4" />
						Abrir conversa
					</Button>
				</>
			}
		>
			<div
				data-component="terminal-conversation-layout"
				className="flex min-h-0 flex-1 flex-col md:flex-row"
			>
				<AgentSidebar agents={agents} {...(focus.paneId ? { focusedPaneId: focus.paneId } : {})}>
					<div className="space-y-5 pt-3">
						{radarLoading && agents.length === 0 && (
							<Text size="sm" tone="muted">
								Conectando na central...
							</Text>
						)}

						{!radarLoading && agents.length === 0 && (
							<EmptyFeedback
								icon={SquareTerminal}
								title="Nenhum agent aberto"
								subtitle="Abra uma conversa ou inicie um agent no kw-terminal."
							/>
						)}
					</div>
				</AgentSidebar>

				<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-muted/10 p-6">
					<EmptyFeedback
						icon={SquareTerminal}
						title="Selecione um terminal"
						subtitle="Escolha um agent na lista para abrir a conversa."
					/>
				</div>
			</div>

			<NewSessionDialog
				open={creating}
				onClose={function () {
					setCreating(false);
				}}
			/>
		</PageShell>
	);
}
