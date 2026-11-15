import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, History, MessageSquare, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConversationNewSession } from "@/routes/_app/chat/-components/conversation-new-session";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { Text } from "@/components/typography";
import { ConversationHistory } from "@/routes/_app/chat/-components/conversation-history";
import { ConversationAgents } from "@/routes/_app/chat/-components/conversation-agents";
import { ConversationSidebarHeader } from "@/routes/_app/chat/-components/conversation-sidebar-header";
import { useConversationList } from "@/routes/_app/chat/-utils/use-conversation-list";

export function ConversationSidebar({
	selectedId,
	selectedPaneId,
	historyExpanded,
	onHistoryExpandedChange,
}: {
	selectedId?: string;
	selectedPaneId?: string;
	historyExpanded: boolean;
	onHistoryExpandedChange: (expanded: boolean) => void;
}) {
	const [search, setSearch] = useState("");
	const { projects, selectedProject, setSelectedProjectId, loading } = useProjectFocus();
	const list = useConversationList();
	const { connected } = useAgentRadar();
	return (
		<div
			data-component="conversation-sidebar"
			className="flex h-full min-h-0 flex-col divide-y divide-border overflow-hidden bg-chrome text-foreground"
		>
			<ConversationSidebarHeader icon={MessageSquare} title="Chat">
				<Button className="min-h-11 lg:min-h-8" size="sm" asChild>
					<Link to="/chat" search={{ view: "new" }}>
						<Plus className="size-4" />
						Nova conversa
					</Link>
				</Button>
			</ConversationSidebarHeader>
			{!connected && (
				<Text role="status" size="xs" tone="warning" className="shrink-0 px-3 py-2">
					Conectando ao computador…
				</Text>
			)}
			<div className="flex shrink-0 flex-col gap-2 p-3">
				<ConversationNewSession />
				<CustomSelect
					items={projects}
					value={selectedProject?.id ?? ""}
					onValueChange={setSelectedProjectId}
					renderItem={(project) => project.name}
					ariaLabel="Projeto do histórico"
					placeholder="Projeto do histórico"
					loading={loading}
					className="h-11"
				/>
				<div className="relative min-w-0">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						aria-label="Buscar conversas e agents"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar conversas e agents"
						className="h-11 bg-background/50 pl-9 text-base lg:h-9 lg:text-sm"
						maxLength={200}
					/>
				</div>
			</div>
			<div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain lg:flex lg:flex-col lg:overflow-hidden">
				<ConversationAgents
					conversations={list.conversations}
					search={search}
					selectedId={selectedId}
					selectedPaneId={selectedPaneId}
				/>
				<section
					data-section="conversation-history"
					aria-label="Histórico de conversas"
					className="flex flex-col lg:min-h-0 lg:flex-[1_1_0%] lg:overflow-hidden"
				>
					<ConversationSidebarHeader icon={History} title="Histórico">
						<Button
							variant="ghost"
							size="sm"
							aria-expanded={historyExpanded}
							className="min-h-11 lg:min-h-8"
							onClick={() => onHistoryExpandedChange(!historyExpanded)}
						>
							{historyExpanded && <ChevronDown className="size-3.5" />}
							{!historyExpanded && <ChevronUp className="size-3.5" />}
							{historyExpanded ? "Ver menos" : "Ver mais"}
						</Button>
					</ConversationSidebarHeader>
					<div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
						<ConversationHistory
							{...list}
							projectId={selectedProject?.id}
							search={search}
							selectedId={selectedId}
							expanded={historyExpanded}
						/>
					</div>
				</section>
			</div>
		</div>
	);
}
