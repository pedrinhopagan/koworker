import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentPaneView, type AgentPaneMode } from "@/components/agent-radar/agent-pane-view";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";
import { ShellPane } from "./shell-pane";

export function TerminalWorkspaceViewport({
	entry,
	actions,
	agentMode,
}: {
	entry: TerminalWorkspaceEntry;
	actions: TerminalWorkspaceActions;
	agentMode: AgentPaneMode;
}) {
	if (entry.kind === "shell") {
		return <ShellPane key={entry.key} entry={entry} actions={actions} />;
	}

	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<AgentPaneView key={entry.key} paneId={entry.id} mode={agentMode} />
		</div>
	);
}
