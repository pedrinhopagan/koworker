import { X } from "lucide-react";

import type { AgentRadarStatus } from "@/constants/agent-radar";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { cn } from "@/lib/utils";

export type WorkspaceTab =
	| { key: string; kind: "shell"; id: string; title: string; live: boolean }
	| {
			key: string;
			kind: "agent";
			id: string;
			cli: string;
			title: string;
			status: AgentRadarStatus;
	  };

export function WorkspaceTabs({
	tabs,
	activeKey,
	onSelect,
	onCloseShell,
}: {
	tabs: WorkspaceTab[];
	activeKey: string | null;
	onSelect: (key: string) => void;
	onCloseShell: (shellId: string) => void;
}) {
	if (tabs.length === 0) {
		return null;
	}

	return (
		<div
			data-component="workspace-tabs"
			className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-chrome/60 px-2 py-1.5"
		>
			{tabs.map((tab) => {
				const selected = tab.key === activeKey;

				if (tab.kind === "shell") {
					return (
						<span
							key={tab.key}
							data-selected={selected || undefined}
							className={cn(
								"group flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border pr-1.5 pl-3 transition-colors",
								selected
									? "border-primary/30 bg-primary/10 text-primary"
									: "border-border bg-background text-muted-foreground hover:bg-muted",
							)}
						>
							<button
								type="button"
								onClick={() => onSelect(tab.key)}
								className="flex min-w-0 items-center gap-1.5 py-1"
								aria-current={selected ? "true" : undefined}
							>
								<span
									aria-hidden
									className={cn(
										"size-1.5 shrink-0 rounded-full",
										tab.live ? "bg-primary" : "bg-muted-foreground/40",
									)}
								/>
								<span className="max-w-36 truncate text-xs font-semibold">{tab.title}</span>
							</button>
							<button
								type="button"
								aria-label={`Fechar ${tab.title}`}
								onClick={() => onCloseShell(tab.id)}
								className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-warning/20 hover:text-foreground"
							>
								<X className="size-3" />
							</button>
						</span>
					);
				}

				return (
					<button
						key={tab.key}
						type="button"
						onClick={() => onSelect(tab.key)}
						data-selected={selected || undefined}
						aria-current={selected ? "true" : undefined}
						className={cn(
							"flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors",
							selected
								? "border-primary/30 bg-primary/10 text-primary"
								: "border-border bg-background text-muted-foreground hover:bg-muted",
						)}
					>
						<AgentCliIcon agent={tab.cli} className="size-3.5 shrink-0" />
						<span className="max-w-36 truncate text-xs font-semibold">{tab.title}</span>
						<RadarStatusMark
							status={tab.status}
							className={cn("shrink-0", AGENT_RADAR_VISUALS[tab.status].tone)}
						/>
					</button>
				);
			})}
		</div>
	);
}
