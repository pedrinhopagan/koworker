import { FolderOpen, Loader2, PanelLeftClose, Search, SquareTerminal } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { ProjectLogo } from "@/components/project-logo";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentRadarPreviews } from "@/hooks/use-agent-radar-previews";
import { cn } from "@/lib/utils";
import { useShellSidebarStore } from "@/stores/shell-sidebar";
import type {
	TerminalWorkspaceActions,
	TerminalWorkspaceProject,
} from "../-utils/use-terminal-workspace";
import { groupTerminalWorkspaceEntries, terminalWorkspaceEntryTitle } from "./shell-groups";
import { ShellSessionItem } from "./shell-session-item";

function isOpenAgentEntry(entry: TerminalWorkspaceEntry) {
	return entry.kind === "agent" || (!!entry.agent && entry.status !== "exited");
}

export function ShellSidebar({
	entries,
	projects,
	selectedTab,
	loading,
	actions,
	onSelect,
	children,
	mobile = false,
	actionBar,
}: {
	entries: TerminalWorkspaceEntry[];
	projects: TerminalWorkspaceProject[];
	selectedTab: string | null;
	loading: boolean;
	actions: TerminalWorkspaceActions;
	onSelect: (key: string) => void;
	children?: ReactNode;
	mobile?: boolean;
	actionBar?: ReactNode;
}) {
	const [query, setQuery] = useState("");
	const mode = useShellSidebarStore((state) => state.mode);
	const toggleMode = useShellSidebarStore((state) => state.toggleMode);
	const collapsed = !mobile && mode === "compact";
	const agents = entries.filter(isOpenAgentEntry);
	const conversationAgents = entries.filter((entry) => entry.kind === "agent");
	const previews = useAgentRadarPreviews(
		!collapsed && conversationAgents.length > 0,
		conversationAgents.map((entry) => entry.id),
	);
	const filtered = useMemo(() => {
		const needle = query.trim().toLocaleLowerCase();
		if (!needle) return entries;
		return entries.filter((entry) =>
			[
				terminalWorkspaceEntryTitle(entry),
				entry.projectName,
				entry.cwd,
				entry.activity,
				entry.agent,
			]
				.filter(Boolean)
				.some((value) => value?.toLocaleLowerCase().includes(needle)),
		);
	}, [entries, query]);
	const groups = groupTerminalWorkspaceEntries(filtered, projects);
	const projectById = new Map(projects.map((project) => [project.id, project]));

	return (
		<aside
			data-component="shell-sidebar"
			data-collapsed={collapsed || undefined}
			data-mobile={mobile || undefined}
			className={cn(
				"flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-150",
				mobile && "h-auto w-full flex-1 shrink border-r-0 bg-background",
				collapsed && "w-0 overflow-hidden border-r-0",
			)}
		>
			{mobile && (
				<div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
					<Title as="h1" size="md">
						Agents abertos
					</Title>
					<Text as="span" size="xs" tone="muted" className="font-mono tabular-nums">
						{agents.length.toString().padStart(2, "0")}
					</Text>
				</div>
			)}
			{!mobile && (
				<div className="flex h-12 shrink-0 items-center gap-2 border-b border-border pr-1.5 pl-3">
					<SquareTerminal className="size-4 text-primary" />
					<Title as="h2" size="sm" className="flex-1">
						Sessões
					</Title>
					<Text as="span" size="xs" tone="muted" className="font-mono">
						{entries.length.toString().padStart(2, "0")}
					</Text>
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleMode}
						aria-label="Recolher lista de sessões"
						className="text-muted-foreground hover:text-foreground"
					>
						<PanelLeftClose className="size-4" />
					</Button>
				</div>
			)}

			<div className="p-2">
				<div className="relative">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={
							mobile
								? `Buscar em ${entries.length} ${entries.length === 1 ? "sessão" : "sessões"}`
								: "Buscar sessão, projeto ou pasta"
						}
						aria-label="Buscar sessões"
						className="h-12 bg-background/50 pl-8 text-[16px] md:h-8 md:text-xs"
					/>
				</div>
			</div>

			<div
				className={cn(
					"min-h-0 flex-1 overflow-y-auto overscroll-contain",
					mobile ? "py-3" : "py-2",
				)}
			>
				{loading && entries.length === 0 && (
					<div className="flex min-h-24 items-center justify-center">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				)}
				{groups.map((group) => {
					const project = group.projectId ? (projectById.get(group.projectId) ?? null) : null;
					return (
						<section key={group.id} className={cn("mb-3 last:mb-0", mobile && "mb-4")}>
							<div className="mb-1 flex min-w-0 items-center gap-2 px-3 py-1">
								{project ? (
									<ProjectLogo project={project} className="size-4 [&>img]:p-0.5" />
								) : (
									<FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
								)}
								<Text
									as="span"
									size="xs"
									className="min-w-0 flex-1 truncate font-medium text-sidebar-muted-foreground"
								>
									{group.label}
								</Text>
								<Text as="span" size="xs" tone="muted" className="tabular-nums">
									{group.entries.length}
								</Text>
							</div>
							<ul className="space-y-1">
								{group.entries.map((entry) => (
									<ShellSessionItem
										key={entry.key}
										entry={entry}
										selected={entry.key === selectedTab}
										preview={entry.kind === "agent" ? (previews.get(entry.id) ?? null) : null}
										actions={actions}
										onSelect={onSelect}
									/>
								))}
							</ul>
						</section>
					);
				})}
				{!loading && groups.length === 0 && <>{children}</>}
			</div>

			{mobile && actionBar}
		</aside>
	);
}
