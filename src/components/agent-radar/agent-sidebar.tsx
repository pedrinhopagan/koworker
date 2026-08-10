import { PanelLeft } from "lucide-react";
import type { ReactNode } from "react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { AgentList } from "@/components/agent-radar/agent-list";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { Text } from "@/components/typography";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { cn } from "@/lib/utils";
import { useAgentSidebarStore } from "@/stores/agent-sidebar";

export function AgentSidebar({
	agents,
	selectedPaneId,
	focusedPaneId,
	children,
}: {
	agents: RadarAgent[];
	selectedPaneId?: string;
	focusedPaneId?: string;
	children?: ReactNode;
}) {
	const isMobile = useIsMobileViewport();
	const mode = useAgentSidebarStore((state) => state.mode);
	const toggleMode = useAgentSidebarStore((state) => state.toggleMode);
	const compact = mode === "compact" && !isMobile;

	const toggle = (
		<button
			type="button"
			onClick={toggleMode}
			aria-label={compact ? "Expandir sidebar de agents" : "Recolher sidebar de agents"}
			className={cn(
				"hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:flex",
				compact && "mx-auto",
			)}
		>
			<PanelLeft className={cn("size-4 transition-transform", compact && "rotate-180")} />
		</button>
	);

	return (
		<aside
			data-component="agent-sidebar"
			data-compact={compact || undefined}
			className={cn(
				"flex min-h-0 w-full shrink-0 flex-col border-r border-border bg-chrome/60 transition-[width] duration-200 md:w-80",
				compact && "md:w-16",
			)}
		>
			<div
				className={cn(
					"flex h-11 shrink-0 items-center gap-2 border-b border-border px-3",
					compact && "justify-center px-2",
				)}
			>
				{!compact && (
					<>
						<Text as="span" size="xs" className="font-semibold">
							Conversas
						</Text>
						<span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
							{agents.length}
						</span>
						<span className="flex-1" />
					</>
				)}
				{compact ? (
					<SidebarTooltip label="Expandir conversas" triggerClassName="flex">
						{toggle}
					</SidebarTooltip>
				) : (
					toggle
				)}
			</div>

			<div className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "p-2" : "p-3")}>
				{agents.length > 0 && (
					<AgentList
						agents={agents}
						compact={compact}
						{...(selectedPaneId ? { selectedPaneId } : {})}
						{...(focusedPaneId ? { focusedPaneId } : {})}
					/>
				)}
				{!compact && children}
			</div>
		</aside>
	);
}
