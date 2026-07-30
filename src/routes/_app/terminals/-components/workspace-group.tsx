import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { Text, Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import type { KwTerminalActions } from "../-utils/use-kw-terminal-actions";
import { RadarAgentCard } from "./radar-agent-card";
import { TerminalTabRow } from "./terminal-tab-row";
import { WorkspaceActionsMenu } from "./workspace-actions-menu";

type WorkspaceTab = { tab_id: string; label: string; focused: boolean };

type WorkspaceGroupProps = {
	workspaceId: string;
	label: string;
	number: number;
	focused: boolean;
	agents: RadarAgent[];
	tabs: WorkspaceTab[];
	actions: KwTerminalActions;
};

// Um workspace do kw-terminal: os agents são o conteúdo, as tabs sem agent ficam atrás de um toggle
// porque shell puro não se acompanha do celular — só se foca, renomeia ou fecha.
export function WorkspaceGroup({
	workspaceId,
	label,
	number,
	focused,
	agents,
	tabs,
	actions,
}: WorkspaceGroupProps) {
	const [showTabs, setShowTabs] = useState(false);
	const agentTabIds = new Set(agents.map((agent) => agent.tabId));
	const plainTabs = tabs.filter((tab) => !agentTabIds.has(tab.tab_id));

	return (
		<section className="space-y-2">
			<div className="flex items-center gap-2">
				{Number.isFinite(number) && (
					<span className="shrink-0 font-mono text-xs text-muted-foreground">{number}</span>
				)}

				<Title as="h2" size="xs" className="min-w-0 truncate uppercase tracking-wide">
					{label}
				</Title>

				{focused && <Badge variant="success">foco</Badge>}

				<Text size="xs" tone="muted" className="ml-auto shrink-0">
					{agents.length === 0
						? "sem agent"
						: `${agents.length} agent${agents.length > 1 ? "s" : ""}`}
				</Text>

				<WorkspaceActionsMenu workspaceId={workspaceId} label={label} actions={actions} />
			</div>

			{agents.length > 0 && (
				<div className="flex flex-col gap-2">
					{agents.map((agent) => (
						<RadarAgentCard key={agent.paneId} agent={agent} />
					))}
				</div>
			)}

			{plainTabs.length > 0 && (
				<div className="space-y-1">
					<button
						type="button"
						onClick={() => setShowTabs((open) => !open)}
						className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						{showTabs ? (
							<ChevronDown className="size-3.5" />
						) : (
							<ChevronRight className="size-3.5" />
						)}
						{plainTabs.length} tab{plainTabs.length > 1 ? "s" : ""} sem agent
					</button>

					{showTabs && (
						<ul className="flex flex-col gap-1">
							{plainTabs.map((tab) => (
								<TerminalTabRow
									key={tab.tab_id}
									tabId={tab.tab_id}
									label={tab.label}
									focused={tab.focused}
									actions={actions}
								/>
							))}
						</ul>
					)}
				</div>
			)}
		</section>
	);
}
