import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentTerminalView } from "@/components/agent-radar/agent-terminal-view";
import { ConversationLive } from "@/routes/_app/chat/-components/conversation-live";
import { ConversationPaneActions } from "@/routes/_app/chat/-components/conversation-pane-actions";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { agentRadarAgentLabel } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { usePaneMove } from "@/hooks/use-pane-move";
import { usePaneMoves } from "@/stores/pane-moves";

export function ConversationAgentPane({
	paneId,
	onOpenList,
}: {
	paneId: string;
	onOpenList: () => void;
}) {
	const { agents, connected } = useAgentRadar();
	const agent = agents.find((entry) => entry.paneId === paneId);
	const [mode, setMode] = useState<"conversation" | "terminal">("conversation");
	const move = usePaneMove(`agent:${paneId}`);
	const clearMove = usePaneMoves((state) => state.clear);
	const navigate = useNavigate();
	useEffect(() => {
		const nextPaneId = move?.to?.replace(/^agent:/, "");
		if (nextPaneId && agents.some((entry) => entry.paneId === nextPaneId)) {
			clearMove(`agent:${paneId}`);
			void navigate({ to: "/chat", search: { paneId: nextPaneId }, replace: true });
		}
	}, [agents, clearMove, move?.to, navigate, paneId]);
	return (
		<>
			<header className="flex shrink-0 items-center gap-2 border-b border-border bg-chrome px-3 py-2 sm:px-4 sm:py-3">
				<Button
					variant="ghost"
					size="icon"
					className="size-11 shrink-0 lg:hidden"
					onClick={onOpenList}
					aria-label="Voltar às conversas"
				>
					<ArrowLeft className="size-5" />
				</Button>
				<div className="min-w-0 flex-1">
					<Title size="sm" className="truncate">
						{agent?.title ?? agent?.taskTitle ?? agent?.tabLabel ?? "Conversa da CLI"}
					</Title>
					<Text size="xs" tone="muted" className="mt-1 truncate">
						{agent?.projectName ?? agent?.workspaceLabel} ·{" "}
						{agent && agentRadarAgentLabel(agent.agent)}
					</Text>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="min-h-11 sm:min-h-8"
					onClick={() => setMode(mode === "conversation" ? "terminal" : "conversation")}
				>
					{mode === "conversation" && (
						<>
							<SquareTerminal className="size-4" />
							Terminal
						</>
					)}
					{mode === "terminal" && (
						<>
							<MessageSquare className="size-4" />
							Conversa
						</>
					)}
				</Button>
				<ConversationPaneActions
					paneId={paneId}
					busy={agent?.status === "working"}
					disabled={!agent || !!move || !connected}
				/>
			</header>
			{mode === "conversation" && (
				<ConversationLive key={paneId} paneId={paneId} onOpenTerminal={() => setMode("terminal")} />
			)}
			{mode === "terminal" && <AgentTerminalView key={paneId} paneId={paneId} />}
		</>
	);
}
