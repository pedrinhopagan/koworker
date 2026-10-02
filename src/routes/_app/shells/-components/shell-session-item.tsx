import { SquareTerminal, Target, X } from "lucide-react";
import { memo } from "react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Text } from "@/components/typography";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS, agentRadarAgentLabel } from "@/constants/agent-radar";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { modelDisplayLabel } from "@/lib/model-label";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";
import { ShellEntryContextMenu } from "./shell-entry-context-menu";
import {
	terminalWorkspaceEntryDescription,
	terminalWorkspaceEntryTitle,
	terminalWorkspaceRadarStatus,
	terminalWorkspaceStatusText,
} from "./shell-groups";

export type SessionPreview = { text: string | null; model: string | null } | null;

export const ShellSessionItem = memo(function ShellSessionItem({
	entry,
	selected,
	preview,
	actions,
	onSelect,
}: {
	entry: TerminalWorkspaceEntry;
	selected: boolean;
	preview: SessionPreview;
	actions: TerminalWorkspaceActions;
	onSelect: (key: string) => void;
}) {
	const title = terminalWorkspaceEntryTitle(entry);
	const status = terminalWorkspaceRadarStatus(entry);
	const visual = status ? AGENT_RADAR_VISUALS[status] : null;
	const statusLabel = status
		? AGENT_RADAR_STATUS_LABELS[status]
		: terminalWorkspaceStatusText(entry);
	const description =
		entry.kind === "agent"
			? (preview?.text ?? entry.activity ?? "Conversa sem atividade recente")
			: (terminalWorkspaceEntryDescription(entry) ?? entry.cwd);

	return (
		<li
			data-component="shell-session-item"
			data-status={entry.status}
			data-selected={selected || undefined}
			className={cn(
				"group relative mx-2 rounded-lg border border-transparent transition-colors",
				selected ? "border-transparent bg-sidebar-row-selected" : "hover:bg-sidebar-row-hover",
				entry.status === "exited" && !selected && "opacity-60",
			)}
		>
			<ShellEntryContextMenu
				entry={entry}
				label={title}
				actions={actions}
				onOpen={() => onSelect(entry.key)}
			>
				<button
					type="button"
					onClick={() => onSelect(entry.key)}
					className="block w-full rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
					aria-current={selected ? "page" : undefined}
				>
					<div className="flex min-w-0 items-center gap-2">
						{entry.agent ? (
							<AgentCliIcon agent={entry.agent} className="size-4 shrink-0" />
						) : (
							<SquareTerminal className="size-4 shrink-0 text-muted-foreground" />
						)}
						<Text as="span" size="xs" className="min-w-0 flex-1 truncate font-semibold">
							{title}
						</Text>
						<span
							className={cn(
								"flex shrink-0 items-center gap-1 text-[11px] font-medium",
								visual?.tone,
								!visual && entry.status === "exited" && "text-destructive",
							)}
						>
							{status && <RadarStatusMark status={status} className={visual?.tone} />}
							{statusLabel}
						</span>
					</div>
					<Text size="xs" tone="muted" className="mt-1 line-clamp-2 leading-snug">
						{description}
					</Text>
					<Text size="xs" tone="muted" className="mt-1 truncate text-[11px]">
						{[
							preview?.model && modelDisplayLabel(preview.model),
							entry.agent && agentRadarAgentLabel(entry.agent),
							relativeTimeFrom(entry.changedAt),
						]
							.filter(Boolean)
							.join(" · ")}
					</Text>
				</button>
			</ShellEntryContextMenu>

			{entry.kind === "agent" && entry.capabilities.focusExternal && (
				<button
					type="button"
					onClick={() => actions.focusExternal(entry)}
					aria-label="Focar no terminal externo"
					className="absolute right-1 bottom-1 hidden size-6 items-center justify-center rounded-md bg-card text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 md:flex [@media(pointer:coarse)]:hidden"
				>
					<Target className="size-3" />
				</button>
			)}
			{entry.capabilities.close && (
				<button
					type="button"
					onClick={() => actions.close(entry)}
					aria-label={`Fechar ${title}`}
					className="absolute top-1 right-1 hidden size-6 items-center justify-center rounded-md bg-card text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 md:flex [@media(pointer:coarse)]:hidden"
				>
					<X className="size-3" />
				</button>
			)}
		</li>
	);
});
