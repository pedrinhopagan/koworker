import { X } from "lucide-react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import type { AgentRadarStatus } from "@/constants/agent-radar";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { cn } from "@/lib/utils";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";
import { terminalWorkspaceEntryTitle } from "./shell-groups";

function radarStatus(entry: TerminalWorkspaceEntry): AgentRadarStatus | null {
	if (entry.kind === "agent") {
		return entry.status;
	}

	return entry.status === "working" || entry.status === "idle" ? entry.status : null;
}

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
			className="no-scrollbar flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-border bg-chrome/60"
		>
			{entries.map((entry) => {
				const selected = entry.key === activeKey;
				const status = radarStatus(entry);
				const title = terminalWorkspaceEntryTitle(entry);

				return (
					<span
						key={entry.key}
						data-selected={selected || undefined}
						data-agent={entry.agent ?? undefined}
						className={cn(
							"group flex shrink-0 items-center gap-1.5 border-r border-border px-2 transition-colors",
							selected
								? "bg-background text-foreground shadow-[inset_0_2px_0_var(--project-accent,var(--primary))]"
								: "bg-chrome/40 text-muted-foreground hover:bg-card hover:text-foreground",
						)}
					>
						<button
							type="button"
							onClick={() => onSelect(entry.key)}
							className="flex h-full min-w-0 items-center gap-1.5 px-1 focus-visible:outline-none"
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
								className="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-warning/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
