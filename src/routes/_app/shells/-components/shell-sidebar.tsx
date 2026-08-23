import { useMutation } from "@tanstack/react-query";
import { Loader2, PanelLeft, Plus, SquareTerminal, Target, X } from "lucide-react";
import type { ReactNode } from "react";
import { memo } from "react";
import { toast } from "sonner";

import type { ShellRecord } from "@/api/helpers/shells/supervisor";
import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { AgentCliIcon } from "@/components/agent-radar/agent-cli";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { Text } from "@/components/typography";
import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { RadarStatusMark } from "@/components/ui/radar-status-mark";
import { AGENT_RADAR_STATUS_LABELS } from "@/constants/agent-radar";
import { useAgentRadarPreviews } from "@/hooks/use-agent-radar-previews";
import { AGENT_RADAR_VISUALS } from "@/lib/agent-radar-status";
import { modelDisplayLabel } from "@/lib/model-label";
import { errorMessage } from "@/lib/orpc-errors";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { useShellSidebarStore } from "@/stores/shell-sidebar";
import {
	groupShellsAndAgents,
	type ProjectSummary,
	type ShellGroup,
	type ShellSidebarEntry,
} from "./shell-groups";

const ShellEntryItem = memo(function ShellEntryItem({
	entry,
	selected,
	projectColor,
	preview,
	compact,
	onSelect,
	onCloseShell,
}: {
	entry: ShellSidebarEntry;
	selected: boolean;
	projectColor: string | null;
	preview: { text: string | null; model: string | null } | null;
	compact: boolean;
	onSelect: (key: string) => void;
	onCloseShell: (shellId: string) => void;
}) {
	if (entry.kind === "shell") {
		const shell = entry.shell;
		const label = shell.title || shell.label;

		if (compact) {
			return (
				<li
					data-component="shell-sidebar-item"
					data-shell-id={shell.id}
					data-selected={selected || undefined}
				>
					<SidebarTooltip
						label={
							<div className="max-w-64">
								<div className="flex items-center gap-2">
									<span className="font-semibold text-popover-foreground">{label}</span>
									<span
										className={shell.status === "live" ? "text-primary" : "text-muted-foreground"}
									>
										{shell.status === "live" ? "ativo" : "encerrado"}
									</span>
								</div>
								<div className="mt-1 truncate text-muted-foreground">{shell.cwd}</div>
							</div>
						}
						triggerClassName="flex"
					>
						<button
							type="button"
							onClick={() => onSelect(entry.key)}
							className={cn(
								"relative flex size-11 items-center justify-center rounded-lg border border-transparent transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
								selected && "border-primary/30 bg-primary/10 text-primary",
							)}
							aria-label={`Abrir ${label}`}
						>
							<span
								aria-hidden
								className={cn(
									"absolute top-1.5 right-1.5 size-1.5 rounded-full",
									shell.status === "live" ? "bg-primary" : "bg-muted-foreground/40",
								)}
							/>
							<SquareTerminal className="size-4" />
						</button>
					</SidebarTooltip>
				</li>
			);
		}

		return (
			<li
				data-component="shell-sidebar-item"
				data-shell-id={shell.id}
				data-selected={selected || undefined}
				className={cn(
					"group relative rounded-lg border border-transparent transition-colors",
					selected ? "border-primary/20 bg-primary/10" : "hover:bg-muted/50 active:bg-muted/70",
					shell.status === "exited" && !selected && "opacity-70",
				)}
			>
				<button
					type="button"
					onClick={() => onSelect(entry.key)}
					className="block min-w-0 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					aria-label={`Abrir ${label}`}
				>
					<div className="flex min-w-0 items-center gap-1.5">
						<span
							aria-hidden
							className={cn(
								"size-1.5 shrink-0 rounded-full",
								shell.status === "live" ? "bg-primary" : "bg-muted-foreground/40",
							)}
						/>
						<Text as="span" size="xs" className="min-w-0 truncate font-semibold">
							{label}
						</Text>
						<Text
							as="span"
							size="xs"
							tone="muted"
							className="ml-auto shrink-0 font-mono text-[10px]"
						>
							{relativeTimeFrom(shell.createdAt)}
						</Text>
					</div>

					<Text size="xs" tone="muted" className="mt-1.5 truncate font-mono text-[10px]">
						{[
							shell.status === "live" ? "ativo" : `encerrado (${shell.exitCode ?? "?"})`,
							shell.cwd,
						].join(" · ")}
					</Text>
				</button>

				<button
					type="button"
					aria-label={`Fechar ${label}`}
					onClick={(event) => {
						event.stopPropagation();
						onCloseShell(shell.id);
					}}
					className="absolute top-1.5 right-1.5 hidden size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground group-hover:flex"
				>
					<X className="size-3.5" />
				</button>
				{projectColor && (
					<span
						aria-hidden
						className="absolute bottom-2 left-1.5 size-1.5 shrink-0 opacity-60"
						style={{ backgroundColor: projectColor }}
					/>
				)}
			</li>
		);
	}

	const agent = entry.agent;
	const visual = AGENT_RADAR_VISUALS[agent.status];
	const label = agent.taskTitle ?? agent.title ?? agent.projectName ?? agent.tabLabel;

	if (compact) {
		return (
			<li
				data-component="shell-sidebar-item"
				data-pane-id={agent.paneId}
				data-selected={selected || undefined}
			>
				<SidebarTooltip
					label={
						<div className="max-w-64">
							<div className="flex items-center gap-2">
								<span className="font-semibold text-popover-foreground">{label}</span>
								<span className={visual.tone}>{AGENT_RADAR_STATUS_LABELS[agent.status]}</span>
							</div>
							<div className="mt-1 truncate text-muted-foreground">
								{agent.projectName ?? agent.cwd} · {agent.agent}
							</div>
						</div>
					}
					triggerClassName="flex"
				>
					<button
						type="button"
						onClick={() => onSelect(entry.key)}
						className={cn(
							"relative flex size-11 items-center justify-center rounded-lg border border-transparent transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
							selected && "border-primary/30 bg-primary/10 text-primary",
						)}
						aria-label={`Abrir conversa de ${label}`}
					>
						<RadarStatusMark
							status={agent.status}
							className={cn("absolute top-1.5 right-1.5", visual.tone)}
						/>
						<AgentCliIcon agent={agent.agent} className="size-5" />
					</button>
				</SidebarTooltip>
			</li>
		);
	}

	return (
		<li
			data-component="shell-sidebar-item"
			data-pane-id={agent.paneId}
			data-status={agent.status}
			data-selected={selected || undefined}
			className={cn(
				"group relative rounded-lg border border-transparent transition-colors",
				selected ? "border-primary/20 bg-primary/10" : "hover:bg-muted/50 active:bg-muted/70",
			)}
		>
			<button
				type="button"
				onClick={() => onSelect(entry.key)}
				data-slot="open-conversation"
				className="block min-w-0 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				aria-label={`Abrir conversa de ${label}`}
			>
				<div className="flex min-w-0 items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-1.5">
						<AgentCliIcon
							agent={agent.agent}
							className="size-4 transition-opacity group-hover:opacity-0"
						/>
						<Text as="span" size="xs" className="min-w-0 truncate font-semibold">
							{label}
						</Text>
					</div>

					<span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
						<Text
							as="span"
							size="xs"
							className={cn("text-[10px] leading-none font-semibold", visual.tone)}
						>
							{AGENT_RADAR_STATUS_LABELS[agent.status]}
						</Text>
						<RadarStatusMark status={agent.status} className={visual.tone} />
					</span>
				</div>

				<Text size="sm" tone="muted" className="mt-2 min-w-0 truncate leading-snug">
					{preview?.text ?? agent.activity ?? "Conversa sem falas"}
				</Text>

				<Text size="xs" tone="muted" className="mt-1 truncate font-mono text-[10px]">
					{[
						preview?.model ? modelDisplayLabel(preview.model) : null,
						agent.taskTitle ?? agent.title,
						relativeTimeFrom(agent.changedAt),
					]
						.filter(Boolean)
						.join(" · ")}
				</Text>
			</button>

			<FocusAgentButton paneId={agent.paneId} />
		</li>
	);
});

function FocusAgentButton({ paneId }: { paneId: string }) {
	const focus = useMutation({
		...orpc.agentRadar.focus.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível focar o agent")),
	});

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label="Focar no terminal"
			onClick={() => focus.mutate({ paneId })}
			className="absolute top-1.5 left-1.5 z-10 hidden size-6 border border-transparent bg-transparent opacity-0 transition-[color,background-color,opacity] group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100 md:flex"
		>
			<Target className="size-3" />
		</Button>
	);
}

function GroupSection({
	group,
	selectedTab,
	projectColor,
	previews,
	compact,
	onSelect,
	onCloseShell,
}: {
	group: ShellGroup;
	selectedTab: string | null;
	projectColor: string | null;
	previews: Map<string, { text: string | null; model: string | null }>;
	compact: boolean;
	onSelect: (key: string) => void;
	onCloseShell: (shellId: string) => void;
}) {
	if (compact) {
		return (
			<ul className="flex flex-col items-center gap-1 px-2 py-2 first:pt-0 last:pb-0">
				{group.entries.map((entry) => (
					<ShellEntryItem
						key={entry.key}
						entry={entry}
						selected={entry.key === selectedTab}
						projectColor={projectColor}
						preview={null}
						compact
						onSelect={onSelect}
						onCloseShell={onCloseShell}
					/>
				))}
			</ul>
		);
	}

	return (
		<section data-component="shell-sidebar-group" className="px-3 py-3 first:pt-0 last:pb-0">
			<div className="mb-1.5 flex min-w-0 items-center gap-2 px-2">
				{projectColor && (
					<span
						aria-hidden="true"
						className="size-2.5 shrink-0 border border-foreground/15"
						style={{ backgroundColor: projectColor }}
					/>
				)}
				<Text as="span" size="xs" className="truncate font-semibold">
					{group.label}
				</Text>
				<Text as="span" size="xs" tone="muted" className="truncate font-mono text-[10px]">
					{group.cwd}
				</Text>
			</div>
			<ul className="space-y-1">
				{group.entries.map((entry) => (
					<ShellEntryItem
						key={entry.key}
						entry={entry}
						selected={entry.key === selectedTab}
						projectColor={projectColor}
						preview={entry.kind === "agent" ? (previews.get(entry.agent.paneId) ?? null) : null}
						compact={false}
						onSelect={onSelect}
						onCloseShell={onCloseShell}
					/>
				))}
			</ul>
		</section>
	);
}

export function ShellSidebar({
	shells,
	agents,
	projects,
	selectedTab,
	loading,
	radarLoading,
	onSelect,
	onCloseShell,
	onNew,
	children,
}: {
	shells: ShellRecord[];
	agents: RadarAgent[];
	projects: ProjectSummary[];
	selectedTab: string | null;
	loading: boolean;
	radarLoading: boolean;
	onSelect: (key: string) => void;
	onCloseShell: (shellId: string) => void;
	onNew: () => void;
	children?: ReactNode;
}) {
	const mode = useShellSidebarStore((state) => state.mode);
	const toggleMode = useShellSidebarStore((state) => state.toggleMode);
	const compact = mode === "compact";

	const paneIds = agents.map((agent) => agent.paneId);
	const previews = useAgentRadarPreviews(!compact && agents.length > 0, paneIds);
	const groups = groupShellsAndAgents(shells, agents, projects);
	const total = groups.reduce((count, group) => count + group.entries.length, 0);

	const toggle = (
		<button
			type="button"
			onClick={toggleMode}
			aria-label={compact ? "Expandir lista de shells" : "Recolher lista de shells"}
			className={cn(
				"hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				compact && "mx-auto",
			)}
		>
			<PanelLeft className={cn("size-4 transition-transform", compact && "rotate-180")} />
		</button>
	);

	return (
		<aside
			data-component="shell-sidebar"
			data-compact={compact || undefined}
			className={cn(
				"flex h-full min-h-0 w-full flex-col bg-chrome/60 md:w-80 md:shrink-0 md:border-r md:border-border",
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
						<Text as="span" size="xs" className="font-semibold uppercase tracking-[0.12em]">
							Shells
						</Text>
						<span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
							{total}
						</span>
						<span className="flex-1" />
					</>
				)}
				{!compact && (
					<button
						type="button"
						onClick={onNew}
						aria-label="Novo shell"
						className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<Plus className="size-4" />
					</button>
				)}
				{toggle}
			</div>

			<div className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "p-2" : "p-3")}>
				{(loading || radarLoading) && shells.length === 0 && agents.length === 0 && (
					<div className="flex min-h-24 items-center justify-center">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				)}

				{groups.map((group) => (
					<GroupSection
						key={group.id}
						group={group}
						selectedTab={selectedTab}
						projectColor={group.color}
						previews={previews}
						compact={compact}
						onSelect={onSelect}
						onCloseShell={onCloseShell}
					/>
				))}

				{!loading && !radarLoading && groups.length === 0 && <>{children}</>}

				{!compact && groups.length > 0 && <>{children}</>}
			</div>
		</aside>
	);
}
