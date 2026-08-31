import { Link } from "@tanstack/react-router";
import {
	ChevronDown,
	CircleStop,
	ExternalLink,
	GitCompare,
	History,
	Loader2,
	Menu,
	MoreVertical,
	PanelLeftOpen,
	Plus,
	RotateCcw,
	Target,
	X,
} from "lucide-react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS, type AgentRadarStatus } from "@/constants/agent-radar";
import { useAgentRadarPreviews } from "@/hooks/use-agent-radar-previews";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { modelDisplayLabel } from "@/lib/model-label";
import { cn } from "@/lib/utils";
import { useShellSidebarStore } from "@/stores/shell-sidebar";
import type {
	TerminalWorkspaceActions,
	TerminalWorkspaceProject,
} from "../-utils/use-terminal-workspace";
import {
	groupTerminalWorkspaceEntries,
	terminalWorkspaceEntryTitle,
	terminalWorkspaceStatusText,
} from "./shell-groups";

function radarStatus(entry: TerminalWorkspaceEntry | null): AgentRadarStatus | null {
	if (!entry) return null;
	if (entry.kind === "agent") return entry.status;
	return entry.status === "working" || entry.status === "idle" ? entry.status : null;
}

export function ShellCockpitHeader({
	entry,
	entries,
	projects,
	canReopen,
	reopening,
	actions,
	onSelect,
	onOpenMobile,
	onNew,
	onOpenConversation,
}: {
	entry: TerminalWorkspaceEntry | null;
	entries: TerminalWorkspaceEntry[];
	projects: TerminalWorkspaceProject[];
	canReopen: boolean;
	reopening: boolean;
	actions: TerminalWorkspaceActions;
	onSelect: (key: string) => void;
	onOpenMobile: () => void;
	onNew: () => void;
	onOpenConversation: () => void;
}) {
	const sidebarMode = useShellSidebarStore((state) => state.mode);
	const toggleSidebar = useShellSidebarStore((state) => state.toggleMode);
	const previews = useAgentRadarPreviews(
		entry?.kind === "agent",
		entry?.kind === "agent" ? [entry.id] : [],
	);
	const preview = entry?.kind === "agent" ? previews.get(entry.id) : null;
	const status = radarStatus(entry);
	const visual = status ? AGENT_RADAR_VISUALS[status] : null;
	const title = entry ? terminalWorkspaceEntryTitle(entry) : "Nenhuma sessão selecionada";
	const statusLabel = entry
		? status
			? AGENT_RADAR_STATUS_LABELS[status]
			: terminalWorkspaceStatusText(entry)
		: "inativo";
	const groups = groupTerminalWorkspaceEntries(entries, projects);

	return (
		<header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-chrome/60 px-2 md:px-3">
			<Button
				variant="ghost"
				size="icon"
				className="md:hidden"
				onClick={onOpenMobile}
				aria-label="Abrir sessões"
			>
				<Menu className="size-4" />
			</Button>
			{sidebarMode === "compact" && (
				<Button
					variant="ghost"
					size="icon"
					className="max-md:hidden"
					onClick={toggleSidebar}
					aria-label="Expandir lista de sessões"
				>
					<PanelLeftOpen className="size-4" />
				</Button>
			)}

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex min-w-0 items-center gap-2 px-1 py-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						{entry?.agent && <AgentCliIcon agent={entry.agent} className="size-4 shrink-0" />}
						<div className="min-w-0">
							<div className="flex min-w-0 items-center gap-1.5">
								<Title as="span" size="xs" className="truncate">
									{title}
								</Title>
								<ChevronDown className="size-3 shrink-0 text-muted-foreground" />
							</div>
							<Text
								as="div"
								size="xs"
								tone="muted"
								className="truncate font-mono text-[9px] leading-3"
							>
								{entry?.projectName ?? entry?.groupLabel ?? "Shells"}
								{preview?.model && ` · ${modelDisplayLabel(preview.model)}`}
							</Text>
						</div>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="max-h-[70dvh] w-[min(360px,calc(100vw-24px))] overflow-y-auto"
				>
					{groups.map((group, index) => (
						<div key={group.id}>
							{index > 0 && <DropdownMenuSeparator />}
							<DropdownMenuLabel className="truncate">{group.label}</DropdownMenuLabel>
							{group.entries.map((candidate) => (
								<DropdownMenuItem
									key={candidate.key}
									onSelect={() => onSelect(candidate.key)}
									className={cn(candidate.key === entry?.key && "bg-accent text-accent-foreground")}
								>
									{candidate.agent && <AgentCliIcon agent={candidate.agent} className="size-4" />}
									<span className="min-w-0 flex-1 truncate">
										{terminalWorkspaceEntryTitle(candidate)}
									</span>
									<Text as="span" size="xs" tone="muted" className="font-mono text-[9px]">
										{terminalWorkspaceStatusText(candidate)}
									</Text>
								</DropdownMenuItem>
							))}
						</div>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			<span className="flex-1" />
			<span
				className={cn(
					"hidden shrink-0 items-center gap-1.5 border border-border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest sm:flex",
					visual?.tone,
					entry?.status === "exited" && "text-destructive",
				)}
			>
				{status && <RadarStatusMark status={status} className={visual?.tone} />}
				{statusLabel}
			</span>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" aria-label="Ações da sessão">
						<MoreVertical className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{entry?.kind === "agent" && entry.capabilities.focusExternal && (
						<DropdownMenuItem onSelect={() => actions.focusExternal(entry)}>
							<Target />
							Focar no terminal
						</DropdownMenuItem>
					)}
					{entry?.kind === "agent" && entry.capabilities.diff && (
						<DropdownMenuItem onSelect={() => actions.openDiff(entry)}>
							<GitCompare />
							Ver diff
						</DropdownMenuItem>
					)}
					{entry?.kind === "agent" &&
						entry.capabilities.interrupt &&
						entry.status === "working" && (
							<DropdownMenuItem onSelect={() => actions.interrupt(entry)}>
								<CircleStop />
								Interromper
							</DropdownMenuItem>
						)}
					{entry?.capabilities.close && (
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onSelect={() => actions.close(entry)}
						>
							<X />
							Fechar sessão
						</DropdownMenuItem>
					)}
					{entry && <DropdownMenuSeparator />}
					{canReopen && (
						<DropdownMenuItem disabled={reopening} onSelect={actions.reopen}>
							{reopening ? <Loader2 className="animate-spin" /> : <RotateCcw />}Reabrir terminais
						</DropdownMenuItem>
					)}
					<DropdownMenuItem onSelect={onOpenConversation}>
						<ExternalLink />
						Abrir conversa de agent
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to="/terminals/history">
							<History />
							Histórico de conversas
						</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Button size="sm" onClick={onNew}>
				<Plus className="size-4" />
				<span className="max-sm:hidden">Nova sessão</span>
			</Button>
		</header>
	);
}
