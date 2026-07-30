import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc, type RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { newClientRequestId } from "@/lib/client-request-id";
import { errorMessage } from "@/lib/orpc-errors";
import { toConversations } from "./conversations";
import { ActiveExecutions, RecentExecutions } from "./execution-history";
import { SessionList } from "./session-list";

type Session = RouterOutputs["agentSessions"]["list"][number];

// O histórico saiu da tela principal: no celular a conversa ocupa tudo e o que já rodou fica a um
// toque de distância, não competindo com o campo de escrever.
export function SessionsDrawer({
	open,
	sessions,
	sessionsLoading,
	onOpenChange,
}: {
	open: boolean;
	sessions: Session[];
	sessionsLoading: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const runsQuery = useQuery({
		...orpc.prompt.listRuns.queryOptions({ input: { limit: 50 } }),
		enabled: open,
		refetchInterval: (query) =>
			query.state.data?.some((run) => run.status === "running") ? 2500 : false,
	});

	function refreshRuns() {
		return queryClient.invalidateQueries({ queryKey: orpc.prompt.listRuns.key() });
	}

	const retryMutation = useMutation({
		...orpc.prompt.retry.mutationOptions(),
		onSuccess: () => void refreshRuns(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível repetir a execução")),
	});
	const cancelMutation = useMutation({
		...orpc.prompt.cancel.mutationOptions(),
		onSuccess: () => void refreshRuns(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível interromper a execução")),
	});
	const clearMutation = useMutation({
		...orpc.prompt.clearRuns.mutationOptions(),
		onSuccess: ({ cleared }) => {
			void refreshRuns();
			toast.success(
				cleared === 1
					? "Execução removida do histórico"
					: `${cleared} execuções removidas do histórico`,
			);
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível limpar o histórico")),
	});

	const conversations = toConversations(runsQuery.data ?? []);
	const pending = retryMutation.isPending || cancelMutation.isPending || clearMutation.isPending;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full max-w-md p-0 sm:max-w-lg">
				<SheetHeader className="border-b border-border px-4 py-4 pr-12 text-left">
					<SheetTitle asChild>
						<Title size="md">Conversas</Title>
					</SheetTitle>
					<Text size="sm" tone="muted">
						As sessões abertas e tudo o que já rodou.
					</Text>
				</SheetHeader>

				<div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
					<SessionList sessions={sessions} loading={sessionsLoading} />
					<ActiveExecutions
						conversations={conversations.filter(
							(conversation) => conversation.latest.status === "running",
						)}
						loading={runsQuery.isLoading}
						pending={pending}
						onCancel={(runId) => cancelMutation.mutate({ runId })}
					/>
					<RecentExecutions
						conversations={conversations.filter(
							(conversation) => conversation.latest.status !== "running",
						)}
						pending={pending}
						onRetry={(runId) =>
							retryMutation.mutate({ runId, clientRequestId: newClientRequestId() })
						}
						onClear={(runIds) => clearMutation.mutate({ runIds })}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
