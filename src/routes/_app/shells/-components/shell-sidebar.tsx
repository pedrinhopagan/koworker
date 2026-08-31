import { FolderOpen, Loader2, PanelLeftClose, Search, SquareTerminal } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { ProjectLogo } from "@/components/project-logo";
import { Text, Title } from "@/components/typography";
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

export function ShellSidebar({
	entries,
	projects,
	selectedTab,
	loading,
	actions,
	onSelect,
	children,
	mobile = false,
}: {
	entries: TerminalWorkspaceEntry[];
	projects: TerminalWorkspaceProject[];
	selectedTab: string | null;
	loading: boolean;
	actions: TerminalWorkspaceActions;
	onSelect: (key: string) => void;
	children?: ReactNode;
	mobile?: boolean;
}) {
	const [query, setQuery] = useState("");
	const mode = useShellSidebarStore((state) => state.mode);
	const toggleMode = useShellSidebarStore((state) => state.toggleMode);
	const collapsed = !mobile && mode === "compact";
	const agents = entries.filter((entry) => entry.kind === "agent");
	const previews = useAgentRadarPreviews(
		!collapsed && agents.length > 0,
		agents.map((entry) => entry.id),
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
			className={cn(
				"flex h-full min-h-0 w-[300px] shrink-0 flex-col border-r border-border bg-chrome/75 transition-[width] duration-150",
				mobile && "w-full border-r-0",
				collapsed && "w-0 overflow-hidden border-r-0",
			)}
		>
			<div
				className={cn(
					"flex h-12 shrink-0 items-center gap-2 border-b border-border px-3",
					mobile && "pr-11",
				)}
			>
				<SquareTerminal className="size-4 text-primary" />
				<Title as="h2" size="sm" className="flex-1">
					Sessões
				</Title>
				<Text as="span" size="xs" tone="muted" className="font-mono">
					{entries.length.toString().padStart(2, "0")}
				</Text>
			</div>

			<div className="border-b border-border p-2">
				<div className="relative">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Buscar sessão, projeto ou pasta"
						aria-label="Buscar sessões"
						className="h-8 bg-background/50 pl-8 text-xs"
					/>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto py-2">
				{loading && entries.length === 0 && (
					<div className="flex min-h-24 items-center justify-center">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				)}
				{groups.map((group) => {
					const project = group.projectId ? (projectById.get(group.projectId) ?? null) : null;
					return (
						<section key={group.id} className="mb-3 last:mb-0">
							<div className="mb-1 flex min-w-0 items-center gap-2 px-3 py-1">
								{project ? (
									<ProjectLogo project={project} className="size-4 [&>img]:p-0.5" />
								) : (
									<FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
								)}
								<Text
									as="span"
									size="xs"
									className="min-w-0 flex-1 truncate font-bold uppercase tracking-wider"
								>
									{group.label}
								</Text>
								<Text as="span" size="xs" tone="faint" className="font-mono text-[9px]">
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

			{!mobile && (
				<button
					type="button"
					onClick={toggleMode}
					className="flex h-10 shrink-0 items-center justify-center gap-2 border-t border-border text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<PanelLeftClose className="size-4" />
					Recolher lista
				</button>
			)}
		</aside>
	);
}
