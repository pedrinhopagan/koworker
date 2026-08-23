import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Columns2,
	ExternalLink,
	History,
	Loader2,
	MoreVertical,
	Plus,
	RotateCcw,
	SquareTerminal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { AgentConversationView } from "@/components/agent-radar/agent-conversation";
import { NewSessionDialog } from "@/components/agent-radar/new-session-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { errorMessage } from "@/lib/orpc-errors";
import { useSplitViewStore } from "@/stores/split-view";
import { NewShellDialog } from "./-components/new-shell-dialog";
import { agentTabKey, parseAgentPaneId, parseShellTabKey } from "./-components/shell-groups";
import { ShellPane } from "./-components/shell-pane";
import { ShellSidebar } from "./-components/shell-sidebar";
import { ShellWorkspace } from "./-components/shell-workspace";
import { WorkspaceTabs, type WorkspaceTab } from "./-components/workspace-tabs";

export const Route = createLazyFileRoute("/_app/shells/")({
	component: ShellsWorkspacePage,
});

function ShellsWorkspacePage() {
	const { tab } = Route.useSearch();
	const nested = Route.useRouteContext({ select: (context) => context.nested === true });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [creating, setCreating] = useState(false);
	const [openingConversation, setOpeningConversation] = useState(false);

	const shellsQuery = useQuery({
		...orpc.shells.list.queryOptions(),
		refetchInterval: 5_000,
	});
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const { agents, loading: radarLoading } = useAgentRadar();
	const savedTerminals = useQuery({
		...orpc.agentRadar.savedTerminals.queryOptions(),
		enabled: !radarLoading && agents.length === 0,
	});

	const pinPane = useSplitViewStore((state) => state.pin);

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

	const closeShell = useMutation({
		...orpc.shells.close.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: orpc.shells.list.key() });
			void queryClient.invalidateQueries({ queryKey: orpc.shells.get.key() });
		},
		onError: (error) => toast.error(errorMessage(error, "Não foi possível fechar o shell")),
	});

	const shells = shellsQuery.data?.shells ?? [];
	const projects = projectsQuery.data ?? [];
	const loading = shellsQuery.isPending || projectsQuery.isPending;

	const shellIdFromTab = parseShellTabKey(tab);
	const paneIdFromTab = parseAgentPaneId(tab);
	const activeShell = shells.find((shell) => shell.id === shellIdFromTab) ?? null;
	const activeAgent = agents.find((agent) => agent.paneId === paneIdFromTab) ?? null;
	const hasActive = !!(activeShell || activeAgent);
	const activeKey = hasActive && tab ? tab : null;

	function select(key: string | null) {
		void navigate({ to: "/shells", search: key ? { tab: key } : {}, replace: true });
	}

	const workspaceTabs: WorkspaceTab[] = [
		...shells.map((shell) => ({
			key: shell.id,
			kind: "shell" as const,
			id: shell.id,
			title: shell.title || shell.label,
			live: shell.status === "live",
		})),
		...agents.map((agent) => ({
			key: agentTabKey(agent.paneId),
			kind: "agent" as const,
			id: agent.paneId,
			cli: agent.agent,
			title: agent.taskTitle ?? agent.title ?? agent.projectName ?? agent.tabLabel,
			status: agent.status,
		})),
	];

	const rail = (
		<ShellSidebar
			shells={shells}
			agents={agents}
			projects={projects}
			selectedTab={activeKey}
			loading={loading}
			radarLoading={radarLoading}
			onSelect={(key) => select(key)}
			onCloseShell={(shellId) => closeShell.mutate({ id: shellId })}
			onNew={() => setCreating(true)}
		>
			<div className="space-y-4 pt-3">
				{!loading && !radarLoading && shells.length === 0 && agents.length === 0 && (
					<EmptyFeedback
						icon={SquareTerminal}
						title="Nada aberto"
						subtitle="Abra um shell ou uma conversa de agent."
					/>
				)}

				<p className="px-2 text-xs leading-relaxed text-muted-foreground">
					Tudo que estava no kw-terminal vive aqui: conversas de agent e PTYs de verdade, agrupados
					por projeto. Use <span className="font-semibold">Dividir tela</span> na sidebar para
					prender esta rota à esquerda e navegar pelo resto do app na direita.
				</p>
			</div>
		</ShellSidebar>
	);

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<header
				data-component="shells-header"
				className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-chrome/40 px-3"
			>
				<SquareTerminal className="size-4 shrink-0 text-[var(--project-accent,var(--primary))]" />
				<span className="hidden text-sm font-semibold tracking-[0.12em] uppercase sm:block">
					Shells
				</span>

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
						<span className="max-sm:hidden">Reabrir terminais</span>
					</Button>
				)}

				<span className="flex-1" />

				{!nested && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => pinPane(`/shells${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`)}
						className="max-md:hidden"
					>
						<Columns2 className="size-4" />
						<span className="max-lg:hidden">Fixar à esquerda</span>
					</Button>
				)}

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" aria-label="Mais ações">
							<MoreVertical className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => setCreating(true)}>
							<Plus className="size-4" />
							Novo shell
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setOpeningConversation(true)}>
							<ExternalLink className="size-4" />
							Abrir conversa de agent
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to="/terminals/history">
								<History className="size-4" />
								Histórico de conversas
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<Button size="sm" onClick={() => setCreating(true)}>
					<Plus className="size-4" />
					<span className="max-sm:hidden">Novo</span>
				</Button>
			</header>

			<ShellWorkspace
				rail={rail}
				tabs={
					<WorkspaceTabs
						tabs={workspaceTabs}
						activeKey={activeKey}
						onSelect={(key) => select(key)}
						onCloseShell={(shellId) => closeShell.mutate({ id: shellId })}
					/>
				}
			>
				{activeShell && <ShellPane shellId={activeShell.id} onDismiss={() => select(null)} />}

				{!activeShell && activeAgent && (
					<div className="flex min-h-0 min-w-0 flex-1">
						<AgentConversationView paneId={activeAgent.paneId} />
					</div>
				)}

				{!hasActive && (
					<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-muted/10 p-6">
						<EmptyFeedback
							icon={SquareTerminal}
							title={workspaceTabs.length === 0 ? "Nenhum terminal aberto" : "Selecione uma aba"}
							subtitle={
								workspaceTabs.length === 0
									? "Abra um PTY na pasta de qualquer projeto ou conversa com um agent."
									: "Escolha um shell ou conversa na lista à esquerda."
							}
						/>
					</div>
				)}
			</ShellWorkspace>

			<NewShellDialog
				open={creating}
				onClose={function () {
					setCreating(false);
				}}
			/>

			<NewSessionDialog
				open={openingConversation}
				onClose={function () {
					setOpeningConversation(false);
				}}
			/>
		</div>
	);
}
