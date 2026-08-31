import { useMutation, useQuery } from "@tanstack/react-query";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	GitBranch,
	GitCompare,
	History,
	Loader2,
	PlayCircle,
	Radio,
	SquareTerminal,
} from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { agentCliVisual } from "@/components/agent-radar/agent-cli";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { PageShell } from "@/components/layout/page-shell";
import { TaskLink } from "@/components/task-link";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useCliHistory } from "@/hooks/use-cli-history";
import { errorMessage } from "@/lib/orpc-errors";
import { formatDateTime, formatDuration } from "@/lib/relative-time";
import { HistoryList } from "../../../-components/history-list";
import { useHistoryFilters } from "../../../-utils/use-history-filters";

export const Route = createLazyFileRoute("/_app/terminals/history/$cli/$sessionId/")({
	component: HistorySessionPage,
});

function HistorySessionPage() {
	const { cli, sessionId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { filters, linkSearch } = useHistoryFilters(search);
	const history = useCliHistory(filters);
	const agentCli = cli === "codex" ? "codex" : "claude";
	const visual = agentCliVisual(agentCli);

	const session = useQuery(
		orpc.agentHistory.get.queryOptions({ input: { cli: agentCli, sessionId } }),
	);
	const detail = session.data ?? null;

	const resume = useMutation({
		...orpc.agentHistory.resume.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível retomar a conversa")),
		onSuccess: async (result) => {
			if (!result.reused) {
				toast.success("Conversa retomada em um pane novo");
			}
			await navigate({ to: "/shells", search: { tab: `agent:${result.paneId}` } });
		},
	});
	const openDiff = useMutation({
		...orpc.agentHistory.openDiff.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível abrir o kw-diff")),
	});

	const live = detail?.livePaneId ?? null;
	const duration = detail?.startedAt ? formatDuration(detail.startedAt, detail.updatedAt) : null;

	return (
		<PageShell
			title={detail?.title ?? visual.label}
			description={
				detail
					? [
							visual.label,
							detail.projectName,
							detail.startedAt ? formatDateTime(detail.startedAt) : null,
							duration,
						]
							.filter(Boolean)
							.join(" · ")
					: "Conversa gravada pelo CLI"
			}
			icon={visual.icon}
			headerClassName="mb-0"
			contentClassName="flex min-h-0 max-w-none flex-col px-0"
			actions={
				<div className="flex flex-wrap items-center gap-2">
					{live && (
						<Badge variant="success" className="gap-1">
							<Radio className="size-3" />
							Aberta agora
						</Badge>
					)}
					{detail?.gitBranch && (
						<Badge variant="muted" className="gap-1">
							<GitBranch className="size-3" />
							{detail.gitBranch}
						</Badge>
					)}
					{detail?.tasks.map((task) => (
						<TaskLink key={task.taskId} taskId={task.taskId} label={task.title ?? "Tarefa"} />
					))}
					<Button
						size="sm"
						disabled={resume.isPending}
						onClick={() => resume.mutate({ cli: agentCli, sessionId })}
					>
						{resume.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<PlayCircle className="size-4" />
						)}
						{live ? "Ir para o terminal" : "Retomar no terminal"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={openDiff.isPending}
						onClick={() => openDiff.mutate({ cli: agentCli, sessionId })}
					>
						<GitCompare className="size-4" />
						Ver mudanças
					</Button>
					<Button asChild variant="outline" size="sm" className="md:hidden">
						<Link to="/terminals/history" search={linkSearch}>
							<ArrowLeft className="size-4" />
							Histórico
						</Link>
					</Button>
				</div>
			}
		>
			<div data-component="history-conversation-layout" className="flex min-h-0 flex-1">
				<aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-chrome/60 md:flex">
					<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
						<History className="size-4 text-muted-foreground" />
						<Text as="span" size="xs" className="font-semibold">
							Histórico
						</Text>
						<span className="flex-1" />
						<Link
							to="/terminals/history"
							search={linkSearch}
							className="text-xs text-muted-foreground hover:text-foreground"
						>
							Filtros
						</Link>
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto p-3">
						<HistoryList
							sessions={history.sessions}
							search={linkSearch}
							loading={history.loading}
							hasMore={history.hasMore}
							refreshing={history.refreshing}
							onLoadMore={history.loadMore}
							selectedSessionId={sessionId}
							compact
						/>
					</div>
				</aside>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10">
					{detail?.cwdLabel && (
						<div className="shrink-0 border-b border-border px-4 py-2">
							<Text size="xs" tone="muted" className="truncate font-mono">
								{detail.cwdLabel}
							</Text>
						</div>
					)}

					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
						<div className="mx-auto w-full max-w-3xl space-y-5 pb-6 pt-5">
							{session.isLoading && (
								<div className="flex min-h-32 items-center justify-center">
									<Loader2 className="size-5 animate-spin text-muted-foreground" />
								</div>
							)}

							{session.isError && (
								<EmptyFeedback
									icon={SquareTerminal}
									title="Conversa indisponível"
									subtitle={errorMessage(
										session.error,
										"O arquivo desta sessão não foi encontrado",
									)}
								/>
							)}

							{detail && detail.events.length === 0 && (
								<EmptyFeedback
									icon={SquareTerminal}
									title="Conversa vazia"
									subtitle="O CLI criou a sessão mas nada chegou a ser registrado nela."
								/>
							)}

							{detail && detail.events.length > 0 && (
								<SessionTimeline events={detail.events} busy={false} agent={agentCli} />
							)}
						</div>
					</div>
				</div>
			</div>
		</PageShell>
	);
}
