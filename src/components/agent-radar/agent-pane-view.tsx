import { AgentConversationView } from "@/components/agent-radar/agent-conversation";
import { AgentTerminalView } from "@/components/agent-radar/agent-terminal-view";

export type AgentPaneMode = "conversation" | "terminal";

export function AgentPaneView({ paneId, mode }: { paneId: string; mode: AgentPaneMode }) {
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			{mode === "conversation" && <AgentConversationView paneId={paneId} />}
			{mode === "terminal" && <AgentTerminalView paneId={paneId} />}
		</div>
	);
}
