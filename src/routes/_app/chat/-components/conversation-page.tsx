import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Title } from "@/components/typography";
import { ConversationSidebar } from "@/routes/_app/chat/-components/conversation-sidebar";
import { ConversationDetail } from "@/routes/_app/chat/-components/conversation-detail";
import { NewConversation } from "@/routes/_app/chat/-components/new-conversation";
import { ConversationAgentPane } from "@/routes/_app/chat/-components/conversation-agent-pane";
import { orpc } from "@/client";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";

const route = getRouteApi("/_app/chat/");

export function ConversationPage() {
	const { id, paneId, view } = route.useSearch();
	const navigate = useNavigate();
	const compact = useIsMobileViewport("(max-width: 1023px)");
	const [historyExpanded, setHistoryExpanded] = useState(false);
	const { data: conversations } = useQuery(
		orpc.conversations.list.queryOptions({ throwOnError: false }),
	);
	const { agents } = useAgentRadar();
	const selected = conversations?.find((conversation) => conversation.id === id);
	const livePaneId =
		selected?.threadId &&
		agents.find((agent) => agent.agent === "codex" && agent.sessionId === selected.threadId)
			?.paneId;
	const activePaneId = paneId ?? livePaneId;
	const showList = compact && !id && !activePaneId && view !== "new";
	const openList = () => void navigate({ to: "/chat", search: {} });
	const sidebar = (
		<ConversationSidebar
			selectedId={id}
			selectedPaneId={activePaneId || undefined}
			historyExpanded={historyExpanded}
			onHistoryExpandedChange={setHistoryExpanded}
		/>
	);

	return (
		<div
			data-component="chat-page"
			className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background text-foreground"
		>
			{!compact && <aside className="w-[300px] shrink-0 border-r border-border">{sidebar}</aside>}
			{showList && <div className="min-h-0 min-w-0 flex-1">{sidebar}</div>}
			{!showList && (
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					{!id && !activePaneId && compact && (
						<header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-chrome px-3">
							<Button
								variant="ghost"
								size="icon"
								className="size-11"
								onClick={openList}
								aria-label="Voltar às conversas"
							>
								<ArrowLeft className="size-5" />
							</Button>
							<Title size="sm">Nova conversa</Title>
						</header>
					)}
					{id && !activePaneId && <ConversationDetail key={id} id={id} onOpenList={openList} />}
					{activePaneId && (
						<ConversationAgentPane key={activePaneId} paneId={activePaneId} onOpenList={openList} />
					)}
					{!id && !activePaneId && <NewConversation />}
				</div>
			)}
		</div>
	);
}
