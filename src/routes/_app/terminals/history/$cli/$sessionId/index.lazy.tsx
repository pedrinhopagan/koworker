import { useMutation, useQuery } from "@tanstack/react-query";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	FolderGit2,
	GitBranch,
	GitCompare,
	ListTree,
	Loader2,
	PlayCircle,
	SquareTerminal,
} from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { agentCliVisual } from "@/components/agent-radar/agent-cli";
import { SessionTimeline } from "@/components/agent-session/session-timeline";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { useCliHistory } from "@/hooks/use-cli-history";
import { copyToClipboard } from "@/lib/build-prompt";
import { errorMessage } from "@/lib/orpc-errors";
import { formatDateTime, formatDuration, relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { HistoryList } from "../../../-components/history-list";
import { LiveDot } from "../../../-components/history-session-card";
import { useHistoryFilters } from "../../../-utils/use-history-filters";

export const Route = createLazyFileRoute("/_app/terminals/history/$cli/$sessionId/")({
	component: HistorySessionPage,
});

function Dot() {
	return (
		<span aria-hidden className="text-muted-foreground/50">
			·
		</span>
	);
}

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

	async function copyCwd() {
		if (!detail?.cwd) {
			return;
		}
		const ok = await copyToClipboard(detail.cwd);
		toast[ok ? "success" : "error"](ok ? "Pasta copiada" : "Falha ao copiar a pasta");
	}

	const header = (
		<div className="border-b border-border bg-chrome/40">
			<div className="flex w-full items-start gap-3 px-4 py-3">
				<Button asChild variant="ghost" size="icon-sm" className="-ml-2 shrink-0 md:hidden">
					<Link to="/terminals/history" search={linkSearch} aria-label="Voltar ao histórico">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>

				<visual.icon className={cn("mt-1 size-5 shrink-0", visual.tone)} />

				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<Title as="h1" size="md" className="line-clamp-1 break-all">
						{detail?.title ?? detail?.preview ?? (detail ? "Conversa sem título" : visual.label)}
					</Title>

					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
						{live && <LiveDot />}
						<Text as="span" size="xs" tone="muted" className="shrink-0">
							{live ? "Aberta agora" : visual.label}
						</Text>
						{detail?.projectName && (
							<>
								<Dot />
								<Text as="span" size="xs" tone="muted" className="truncate">
									{detail.projectName}
								</Text>
							</>
						)}
						{detail?.updatedAt && (
							<>
								<Dot />
								<Text
									as="span"
									size="xs"
									tone="muted"
									className="shrink-0"
									title={
										detail.startedAt
											? `${formatDateTime(detail.startedAt)} → ${formatDateTime(detail.updatedAt)}`
											: formatDateTime(detail.updatedAt)
									}
								>
									{relativeTimeFrom(detail.updatedAt)}
									{duration && `, ${duration} de conversa`}
								</Text>
							</>
						)}
						{detail?.gitBranch && (
							<>
								<Dot />
								<span className="inline-flex min-w-0 items-center gap-1">
									<GitBranch className="size-3 shrink-0" />
									<Text as="span" size="xs" tone="muted" className="truncate font-mono">
										{detail.gitBranch}
									</Text>
								</span>
							</>
						)}
						{detail?.cwdLabel && (
							<>
								<Dot />
								<Tooltip label="Copiar caminho da pasta">
									<button
										type="button"
										onClick={() => void copyCwd()}
										className="inline-flex min-w-0 items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
									>
										<FolderGit2 className="size-3 shrink-0" />
										<span className="truncate">{detail.cwdLabel}</span>
									</button>
								</Tooltip>
							</>
						)}
						{detail?.tasks.map((task) => (
							<Link
								key={task.taskId}
								to="/tarefas/$taskId"
								params={{ taskId: task.taskId }}
								className="inline-flex min-w-0 items-center gap-1 text-xs text-primary hover:underline"
							>
								<ListTree className="size-3 shrink-0" />
								<span className="max-w-48 truncate">{task.title ?? "Tarefa"}</span>
							</Link>
						))}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-1.5">
					<Tooltip label="Abrir o kw-diff com o que essa conversa mudou">
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="Ver mudanças"
							disabled={openDiff.isPending}
							onClick={() => openDiff.mutate({ cli: agentCli, sessionId })}
						>
							{openDiff.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<GitCompare className="size-4" />
							)}
						</Button>
					</Tooltip>
					<Button
						size="sm"
						variant={live ? "default" : "outline"}
						disabled={resume.isPending}
						onClick={() => resume.mutate({ cli: agentCli, sessionId })}
					>
						{resume.isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<PlayCircle className="size-4" />
						)}
						<span className="hidden sm:inline">{live ? "Ir para o terminal" : "Retomar"}</span>
					</Button>
				</div>
			</div>
		</div>
	);

	return (
		<PageShell
			title={detail?.title ?? visual.label}
			header={header}
			contentClassName="flex min-h-0 max-w-none flex-col px-0"
		>
			<div data-component="history-conversation-layout" className="flex min-h-0 flex-1">
				<aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-chrome/60 md:flex">
					<div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
						<Text as="span" size="xs" className="font-semibold uppercase tracking-wider">
							Histórico
						</Text>
						<Link
							to="/terminals/history"
							search={linkSearch}
							className="text-xs text-muted-foreground hover:text-foreground"
						>
							Filtrar
						</Link>
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto">
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

				<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-muted/10 px-4">
					<div className="mx-auto w-full max-w-3xl space-y-5 pb-8 pt-6">
						{session.isLoading && (
							<div className="flex min-h-32 items-center justify-center">
								<Loader2 className="size-5 animate-spin text-muted-foreground" />
							</div>
						)}

						{session.isError && (
							<EmptyFeedback
								icon={SquareTerminal}
								title="Conversa indisponível"
								subtitle={errorMessage(session.error, "O arquivo desta sessão não foi encontrado")}
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
		</PageShell>
	);
}
