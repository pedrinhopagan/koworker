import { X } from "lucide-react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { cn } from "@/lib/utils";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";
import { terminalWorkspaceEntryTitle, terminalWorkspaceRadarStatus } from "./shell-groups";

export function WorkspaceTabs({
	entries,
	activeKey,
	actions,
	onSelect,
}: {
	entries: TerminalWorkspaceEntry[];
	activeKey: string | null;
	actions: TerminalWorkspaceActions;
	onSelect: (key: string) => void;
}) {
	if (entries.length === 0) {
		return null;
	}

	return (
		<div
			data-component="workspace-tabs"
			className="no-scrollbar flex h-11 shrink-0 items-center gap-1 px-2 overflow-x-auto border-b border-border bg-background"
		>
			{entries.map((entry) => {
				const selected = entry.key === activeKey;
				const status = terminalWorkspaceRadarStatus(entry);
				const title = terminalWorkspaceEntryTitle(entry);

				return (
					<span
						key={entry.key}
						data-selected={selected || undefined}
						data-agent={entry.agent ?? undefined}
						className={cn(
							"group flex shrink-0 items-center h-8 gap-1.5 rounded-lg border border-transparent px-2 transition-colors",
							selected
								? "border-border bg-card text-foreground shadow-xs"
								: "text-muted-foreground hover:bg-accent hover:text-foreground",
						)}
					>
						<button
							type="button"
							onClick={() => onSelect(entry.key)}
							className="flex h-full min-w-0 items-center gap-1.5 px-1 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							aria-current={selected ? "true" : undefined}
						>
							{entry.agent ? (
								<AgentCliIcon agent={entry.agent} className="size-3.5 shrink-0" />
							) : (
								<span
									aria-hidden
									className={cn(
										"size-1.5 shrink-0 rounded-full",
										entry.status === "live" ? "bg-primary" : "bg-muted-foreground/40",
									)}
								/>
							)}
							<span className="max-w-36 truncate text-xs font-semibold">{title}</span>
							{status && (
								<RadarStatusMark
									status={status}
									className={cn("shrink-0", AGENT_RADAR_VISUALS[status].tone)}
								/>
							)}
						</button>

						{entry.capabilities.close && (
							<button
								type="button"
								aria-label={`Fechar ${title}`}
								onClick={() => actions.close(entry)}
								className="flex size-5 shrink-0 rounded-md items-center justify-center text-muted-foreground transition-colors hover:bg-warning/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							>
								<X className="size-3" />
							</button>
						)}
					</span>
				);
			})}
		</div>
	);
}
