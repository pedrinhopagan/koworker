import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Download, Loader2, MessageSquare, RefreshCw, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import type { ConversationImportInput } from "@/api/schemas/conversations";
import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { CONVERSATION_PROFILES } from "@/constants/conversation";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { useConversationList } from "@/routes/_app/chat/-utils/use-conversation-list";

export function ConversationHistory({
	conversations,
	projectId,
	search,
	selectedId,
	expanded,
	isPending: loadingSaved,
	error: savedError,
	refetch: refetchSaved,
}: ReturnType<typeof useConversationList> & {
	projectId?: string;
	search: string;
	selectedId?: string;
	expanded: boolean;
}) {
	const [profileId, setProfileId] = useState<ConversationImportInput["profileId"]>("default");
	const [committedSearch, setCommittedSearch] = useState(search);
	const [, setSearchDraft] = useDebouncedSearch(committedSearch, setCommittedSearch);
	useEffect(() => setSearchDraft(search), [search, setSearchDraft]);
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { agents } = useAgentRadar();
	const history = useInfiniteQuery({
		...orpc.conversations.cliHistory.infiniteOptions({
			input: (cursor: string | undefined) => ({
				projectId: projectId!,
				profileId,
				search: committedSearch,
				...(cursor ? { cursor } : {}),
			}),
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (page) => page.nextCursor ?? undefined,
			staleTime: 30_000,
			throwOnError: false,
		}),
		enabled: !!projectId,
	});
	const importing = useMutation(
		orpc.conversations.importCli.mutationOptions({
			onSuccess: async (result) => {
				await queryClient.invalidateQueries(orpc.conversations.list.queryOptions());
				await queryClient.invalidateQueries({ queryKey: orpc.conversations.cliHistory.key() });
				await navigate({
					to: "/chat",
					search: {
						...(result.id ? { id: result.id } : {}),
						...(result.paneId ? { paneId: result.paneId } : {}),
					},
				});
			},
		}),
	);
	const term = search.toLocaleLowerCase("pt-BR");
	const saved = conversations.filter(
		(entry) =>
			entry.projectId === projectId &&
			`${entry.title} ${entry.preview ?? ""}`.toLocaleLowerCase("pt-BR").includes(term),
	);
	const linked = new Set(
		saved.filter((entry) => entry.profileId === profileId).map((entry) => entry.threadId),
	);
	const threads = [
		...new Map(
			(history.data?.pages.flatMap((page) => page.threads) ?? [])
				.filter((entry) => !linked.has(entry.threadId))
				.map((entry) => [entry.threadId, entry]),
		).values(),
	];
	const entries = [
		...saved.map((entry) => ({
			key: entry.id,
			title: entry.title,
			updatedAt: entry.updatedAt,
			id: entry.id,
			threadId: entry.threadId,
			profileId: entry.profileId,
		})),
		...threads.map((entry) => ({
			key: `${profileId}:${entry.threadId}`,
			title: entry.title,
			updatedAt: entry.updatedAt,
			id: null,
			threadId: entry.threadId,
			profileId,
		})),
	].toSorted((a, b) => b.updatedAt - a.updatedAt);
	const visible = expanded ? entries : entries.slice(0, 3);
	const loading = loadingSaved || (!!projectId && history.isPending);
	const error = savedError ?? history.error;
	return (
		<div className="py-2">
			<div className="mb-1 flex items-center gap-2 px-3">
				<CustomSelect
					items={[...CONVERSATION_PROFILES]}
					value={profileId}
					onValueChange={(_id, profile) => setProfileId(profile.id)}
					renderItem={(profile) => `Codex ${profile.label}`}
					ariaLabel="Conta do histórico do Codex"
					variant="ghost"
					fitContent
					className="h-11 px-0 text-sm lg:h-8 lg:text-xs"
				/>
				<Tooltip label="Atualizar histórico">
					<Button
						variant="ghost"
						size="icon"
						className="ml-auto size-11 lg:size-8"
						aria-label="Atualizar histórico"
						disabled={history.isFetching}
						onClick={() => {
							void refetchSaved();
							if (projectId) {
								void history.refetch();
							}
						}}
					>
						<RefreshCw className="size-3.5" />
					</Button>
				</Tooltip>
			</div>
			{loading && visible.length === 0 && (
				<div role="status" className="flex h-16 items-center justify-center">
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
				</div>
			)}
			{error && (
				<Text role="alert" size="xs" tone="destructive" className="px-3 py-2">
					{error.message}
				</Text>
			)}
			{!loading && !error && visible.length === 0 && (
				<EmptyFeedback
					icon={MessageSquare}
					title={projectId ? "Nenhuma conversa" : "Selecione um projeto"}
					subtitle={search ? "Ajuste sua busca." : "Comece uma conversa neste projeto."}
					className="px-3 py-3"
				/>
			)}
			<nav className="px-2" aria-label="Histórico de conversas">
				{visible.map((entry) => {
					const livePaneId = agents.find(
						(agent) => agent.agent === "codex" && agent.sessionId === entry.threadId,
					)?.paneId;
					const body = (
						<>
							<div className="min-w-0 flex-1">
								<Text size="sm" className="truncate">
									{entry.title}
								</Text>
								<Text size="xs" tone="faint" className="mt-0.5">
									{livePaneId ? "Aberta na CLI" : "Codex"} · {relativeTimeFrom(entry.updatedAt)}
								</Text>
							</div>
							{livePaneId && (
								<SquareTerminal className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
							)}
							{!entry.id && !livePaneId && (
								<Download className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
							)}
							{importing.isPending && importing.variables?.threadId === entry.threadId && (
								<Loader2 className="mt-1 size-3.5 animate-spin" />
							)}
						</>
					);
					const className = cn(
						"mb-1 flex w-full items-start gap-2 border-l-2 border-transparent px-3 py-2 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
						selectedId === entry.id && "border-l-primary bg-card",
					);
					if (entry.id || livePaneId) {
						return (
							<Link
								key={entry.key}
								to="/chat"
								search={livePaneId ? { paneId: livePaneId } : { id: entry.id! }}
								aria-current={selectedId === entry.id ? "page" : undefined}
								className={className}
							>
								{body}
							</Link>
						);
					}
					return (
						<button
							key={entry.key}
							type="button"
							className={className}
							disabled={importing.isPending}
							onClick={() => {
								if (projectId && entry.threadId) {
									importing.mutate({
										projectId,
										profileId: entry.profileId,
										threadId: entry.threadId,
									});
								}
							}}
						>
							{body}
						</button>
					);
				})}
			</nav>
			{importing.error && (
				<Text role="alert" size="xs" tone="destructive" className="px-3 py-2">
					{importing.error.message}
				</Text>
			)}
			{expanded && history.hasNextPage && (
				<Button
					variant="ghost"
					size="sm"
					className="mx-3"
					disabled={history.isFetchingNextPage}
					onClick={() => void history.fetchNextPage()}
				>
					{history.isFetchingNextPage && <Loader2 className="size-3.5 animate-spin" />}Carregar mais
					conversas
				</Button>
			)}
		</div>
	);
}
