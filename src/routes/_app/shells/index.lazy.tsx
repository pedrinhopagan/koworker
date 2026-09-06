import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";

import type { AgentPaneMode } from "@/components/agent-radar/agent-pane-view";
import { NewSessionDialog } from "@/components/agent-radar/new-session-dialog";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { Button } from "@/components/ui/button";
import { reconnectRealtime } from "@/client";
import type { InvokeCli } from "@/constants/invoke";
import { Text } from "@/components/typography";
import { agentRadarAgentLabel } from "@/constants/agent-radar";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { usePaneMoves } from "@/stores/pane-moves";
import { NewShellDialog } from "./-components/new-shell-dialog";
import { ShellCockpitEmpty } from "./-components/shell-cockpit-empty";
import { ShellCockpitHeader } from "./-components/shell-cockpit-header";
import { ShellMobileActions } from "./-components/shell-mobile-actions";
import { ShellSidebar } from "./-components/shell-sidebar";
import { ShellWorkspace } from "./-components/shell-workspace";
import { TerminalWorkspaceViewport } from "./-components/terminal-workspace-viewport";
import { resolveTerminalWorkspaceSelection } from "./-utils/terminal-workspace-state";
import { usePaneMove } from "./-utils/use-pane-move";
import { useTerminalWorkspace } from "./-utils/use-terminal-workspace";

const MISSING_TAB_GRACE_MS = 3_000;

export const Route = createLazyFileRoute("/_app/shells/")({
	component: ShellsWorkspacePage,
});

function ShellsWorkspacePage() {
	const { tab } = Route.useSearch();
	const navigate = useNavigate();
	const [creating, setCreating] = useState(false);
	const [conversationCli, setConversationCli] = useState<InvokeCli | null>(null);
	const isMobile = useIsMobileViewport("(max-width: 1023px)");
	const { entries, projects, loading, connected, canReopen, reopening, actions } =
		useTerminalWorkspace();
	const activeEntry = entries.find((entry) => entry.key === tab) ?? null;
	const activeKey = activeEntry?.key ?? null;
	const [view, setView] = useState<{ key: string | null; mode: AgentPaneMode }>({
		key: activeKey,
		mode: "conversation",
	});

	if (view.key !== activeKey) {
		setView({ key: activeKey, mode: "conversation" });
	}

	// Conversa em trânsito (modelo trocado, CLI trocada): a aba atual fica de pé enquanto o pane
	// antigo some e a URL só muda quando o pane novo entra no snapshot.
	const move = usePaneMove(tab);
	const clearMove = usePaneMoves((state) => state.clear);

	// No celular a lista é a tela inicial: uma aba que deixou de existir devolve à lista em vez de
	// pular para a primeira sessão, como o desktop faz. Uma aba que ainda não existe ganha um
	// respiro: sessão recém-aberta chega à URL antes de o snapshot do workspace anunciá-la.
	useEffect(() => {
		if (loading) return;
		if (move) {
			if (move.to && entries.some((entry) => entry.key === move.to)) {
				clearMove(tab!);
				void navigate({ to: "/shells", search: { tab: move.to }, replace: true });
			}
			return;
		}
		const present = !tab || entries.some((entry) => entry.key === tab);
		const resolved = isMobile && !present ? null : resolveTerminalWorkspaceSelection(entries, tab);
		if (resolved === (tab ?? null)) return;
		const go = () =>
			void navigate({
				to: "/shells",
				search: resolved ? { tab: resolved } : {},
				replace: true,
			});
		if (present) {
			go();
			return;
		}
		const timer = setTimeout(go, MISSING_TAB_GRACE_MS);
		return () => clearTimeout(timer);
	}, [clearMove, entries, isMobile, loading, move, navigate, tab]);

	function select(key: string) {
		void navigate({ to: "/shells", search: { tab: key } });
	}

	function backToList() {
		void navigate({ to: "/shells", search: {} });
	}

	const showList = isMobile && !tab;
	const empty = (
		<EmptyFeedback
			icon={SquareTerminal}
			title="Nenhuma sessão"
			subtitle={
				entries.length === 0
					? "Abra uma nova sessão para começar."
					: "Nenhuma sessão corresponde à busca."
			}
		/>
	);
	const connecting = !connected && (
		<div
			role="status"
			className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-chrome px-3 text-xs"
		>
			<span>Conectando às sessões…</span>
			<Button variant="outline" size="sm" onClick={reconnectRealtime}>
				Reconectar
			</Button>
		</div>
	);

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-background">
			{showList && (
				<>
					{connecting}
					<ShellSidebar
						mobile
						entries={entries}
						projects={projects}
						selectedTab={null}
						loading={loading}
						actions={actions}
						onSelect={select}
						actionBar={
							<ShellMobileActions
								canReopen={canReopen}
								reopening={reopening}
								onReopen={actions.reopen}
								onConversation={setConversationCli}
								onShell={() => setCreating(true)}
							/>
						}
					>
						{empty}
					</ShellSidebar>
				</>
			)}

			{!showList && (
				<ShellWorkspace
					rail={
						!isMobile && (
							<ShellSidebar
								entries={entries}
								projects={projects}
								selectedTab={activeKey}
								loading={loading}
								actions={actions}
								onSelect={select}
							>
								{empty}
							</ShellSidebar>
						)
					}
				>
					{connecting}
					<ShellCockpitHeader
						entry={activeEntry}
						entries={entries}
						projects={projects}
						canReopen={canReopen}
						reopening={reopening}
						actions={actions}
						agentMode={view.mode}
						onAgentModeChange={(mode) => setView({ key: activeKey, mode })}
						onSelect={select}
						onBack={backToList}
						onNew={() => setCreating(true)}
						onOpenConversation={() => setConversationCli("claude")}
					/>

					<div className="relative flex min-h-0 min-w-0 flex-1 bg-background">
						{activeEntry && (
							<TerminalWorkspaceViewport
								entry={activeEntry}
								actions={actions}
								agentMode={view.mode}
							/>
						)}
						{!activeEntry && !loading && move && (
							<div
								role="status"
								data-component="pane-move-transit"
								className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-background p-6"
							>
								<Loader2 className="size-5 animate-spin text-muted-foreground" />
								<Text size="sm" tone="muted" className="text-center">
									{move.to || move.kind === "reopen"
										? "Abrindo a conversa no novo pane…"
										: `Migrando a conversa para o ${agentRadarAgentLabel(move.cli)}…`}
								</Text>
							</div>
						)}
						{!activeEntry && !loading && !move && (
							<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-y-auto bg-background p-4 sm:p-6">
								<ShellCockpitEmpty
									entries={entries}
									onSelect={select}
									onNewShell={() => setCreating(true)}
									onNewConversation={() => setConversationCli("claude")}
								/>
							</div>
						)}
					</div>
				</ShellWorkspace>
			)}

			<NewShellDialog open={creating} actions={actions} onClose={() => setCreating(false)} />
			<NewSessionDialog
				open={conversationCli !== null}
				defaultCli={conversationCli ?? "claude"}
				actions={actions}
				onClose={() => setConversationCli(null)}
			/>
		</div>
	);
}
