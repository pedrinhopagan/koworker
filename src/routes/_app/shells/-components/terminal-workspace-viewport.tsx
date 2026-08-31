import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentPaneView } from "@/components/agent-radar/agent-pane-view";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";
import { ShellPane } from "./shell-pane";

export function TerminalWorkspaceViewport({
	entry,
	actions,
}: {
	entry: TerminalWorkspaceEntry;
	actions: TerminalWorkspaceActions;
}) {
	if (entry.kind === "shell") {
		return <ShellPane entry={entry} actions={actions} />;
	}

	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<AgentPaneView paneId={entry.id} />
		</div>
	);
}
