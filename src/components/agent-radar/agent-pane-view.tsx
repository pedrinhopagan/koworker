import { MessageSquare, SquareTerminal } from "lucide-react";
import { useState } from "react";

import { AgentConversationView } from "@/components/agent-radar/agent-conversation";
import { AgentTerminalView } from "@/components/agent-radar/agent-terminal-view";
import { Button } from "@/components/ui/button";

type AgentPaneMode = "conversation" | "terminal";

export function AgentPaneView({ paneId }: { paneId: string }) {
	const [mode, setMode] = useState<AgentPaneMode>("conversation");

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col">
			<div className="flex h-9 shrink-0 items-center justify-center gap-1 border-b border-border bg-chrome/30 px-2">
				<Button
					variant={mode === "conversation" ? "secondary" : "ghost"}
					size="sm"
					aria-pressed={mode === "conversation"}
					onClick={() => setMode("conversation")}
				>
					<MessageSquare className="size-3.5" />
					Conversa
				</Button>
				<Button
					variant={mode === "terminal" ? "secondary" : "ghost"}
					size="sm"
					aria-pressed={mode === "terminal"}
					onClick={() => setMode("terminal")}
				>
					<SquareTerminal className="size-3.5" />
					Terminal
				</Button>
			</div>

			{mode === "conversation" && <AgentConversationView paneId={paneId} />}
			{mode === "terminal" && <AgentTerminalView paneId={paneId} />}
		</div>
	);
}
