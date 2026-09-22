import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentConversationView } from "@/components/agent-radar/agent-conversation";
import { AgentPaneView, type AgentPaneMode } from "@/components/agent-radar/agent-pane-view";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";
import { ShellPane } from "./shell-pane";

export function TerminalWorkspaceViewport({
	entry,
	actions,
	agentMode,
	onModeChange,
}: {
	entry: TerminalWorkspaceEntry;
	actions: TerminalWorkspaceActions;
	agentMode: AgentPaneMode;
	onModeChange: (mode: AgentPaneMode) => void;
}) {
	if (entry.kind === "shell" && entry.capabilities.converse && agentMode === "conversation") {
		return (
			<AgentConversationView
				key={entry.key}
				paneId={entry.id}
				shell={entry}
				onOpenTerminal={() => onModeChange("terminal")}
			/>
		);
	}
	if (entry.kind === "shell") {
		return <ShellPane key={entry.key} entry={entry} actions={actions} />;
	}

	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<AgentPaneView
				key={entry.key}
				paneId={entry.id}
				mode={agentMode}
				onOpenTerminal={() => onModeChange("terminal")}
			/>
		</div>
	);
}
