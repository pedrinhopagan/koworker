import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";

import { NewSessionDialog } from "@/components/agent-radar/new-session-dialog";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { NewShellDialog } from "./-components/new-shell-dialog";
import { ShellCockpitEmpty } from "./-components/shell-cockpit-empty";
import { ShellCockpitHeader } from "./-components/shell-cockpit-header";
import { ShellSidebar } from "./-components/shell-sidebar";
import { ShellWorkspace } from "./-components/shell-workspace";
import { TerminalWorkspaceViewport } from "./-components/terminal-workspace-viewport";
import { resolveTerminalWorkspaceSelection } from "./-utils/terminal-workspace-state";
import { useTerminalWorkspace } from "./-utils/use-terminal-workspace";

export const Route = createLazyFileRoute("/_app/shells/")({
	component: ShellsWorkspacePage,
});

function ShellsWorkspacePage() {
	const { tab } = Route.useSearch();
	const navigate = useNavigate();
	const [creating, setCreating] = useState(false);
	const [openingConversation, setOpeningConversation] = useState(false);
	const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
	const { entries, projects, loading, canReopen, reopening, actions } = useTerminalWorkspace();
	const activeEntry = entries.find((entry) => entry.key === tab) ?? null;
	const activeKey = activeEntry?.key ?? null;

	useEffect(() => {
		if (loading) return;
		const resolved = resolveTerminalWorkspaceSelection(entries, tab);
		if (resolved === (tab ?? null)) return;
		void navigate({
			to: "/shells",
			search: resolved ? { tab: resolved } : {},
			replace: true,
		});
	}, [entries, loading, navigate, tab]);

	function select(key: string) {
		void navigate({ to: "/shells", search: { tab: key } });
	}

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
	const rail = (
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
	);

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col bg-background">
			<ShellWorkspace rail={rail}>
				<ShellCockpitHeader
					entry={activeEntry}
					entries={entries}
					projects={projects}
					canReopen={canReopen}
					reopening={reopening}
					actions={actions}
					onSelect={select}
					onOpenMobile={() => setMobileSessionsOpen(true)}
					onNew={() => setCreating(true)}
					onOpenConversation={() => setOpeningConversation(true)}
				/>

				<div className="relative flex min-h-0 min-w-0 flex-1 bg-background">
					{activeEntry && <TerminalWorkspaceViewport entry={activeEntry} actions={actions} />}
					{!activeEntry && (
						<div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-y-auto bg-background p-4 sm:p-6">
							<ShellCockpitEmpty
								entries={entries}
								onSelect={select}
								onNewShell={() => setCreating(true)}
								onNewConversation={() => setOpeningConversation(true)}
							/>
						</div>
					)}
				</div>
			</ShellWorkspace>

			<Sheet open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
				<SheetContent side="left" className="w-[min(88vw,340px)] p-0">
					<SheetHeader className="sr-only">
						<SheetTitle>Sessões abertas</SheetTitle>
						<SheetDescription>Busque e selecione uma sessão para abrir.</SheetDescription>
					</SheetHeader>
					<ShellSidebar
						mobile
						entries={entries}
						projects={projects}
						selectedTab={activeKey}
						loading={loading}
						actions={actions}
						onSelect={(key) => {
							select(key);
							setMobileSessionsOpen(false);
						}}
					>
						{empty}
					</ShellSidebar>
				</SheetContent>
			</Sheet>

			<NewShellDialog open={creating} actions={actions} onClose={() => setCreating(false)} />
			<NewSessionDialog
				open={openingConversation}
				actions={actions}
				onClose={() => setOpeningConversation(false)}
			/>
		</div>
	);
}
