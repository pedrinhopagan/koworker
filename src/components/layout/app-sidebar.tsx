import { Link } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen, SquareTerminal } from "lucide-react";

import { SidebarNavContent } from "@/components/layout/sidebar-nav-content";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebarNavStore } from "@/stores/sidebar-nav";

export function AppSidebar() {
	const mode = useSidebarNavStore((state) => state.mode);
	const toggleMode = useSidebarNavStore((state) => state.toggleMode);
	const compact = mode === "compact";

	return (
		<aside
			data-component="app-sidebar"
			className={cn(
				"hidden shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex",
				compact ? "w-14" : "w-56",
			)}
		>
			<div
				className={cn(
					"flex h-shell-bar shrink-0 items-center px-4",
					compact && "justify-center px-0",
				)}
			>
				<Link
					to="/"
					aria-label="Koworker, início"
					className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<SquareTerminal className="size-5 shrink-0" />
					{!compact && <span>Koworker</span>}
				</Link>
			</div>
			<div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4">
				<SidebarNavContent variant="sidebar" compact={compact} />
			</div>
			<div className="flex h-shell-foot shrink-0 items-center border-t border-border px-2">
				<SidebarTooltip
					label={compact ? "Expandir sidebar (Ctrl+B)" : "Recolher sidebar (Ctrl+B)"}
					triggerClassName="flex w-full"
				>
					<Button
						variant="ghost-muted"
						size="compact"
						onClick={toggleMode}
						aria-label={compact ? "Expandir sidebar" : "Recolher sidebar"}
						className={cn(
							"w-full justify-start gap-2.5 text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
							compact && "justify-center px-0",
						)}
					>
						{compact && <PanelLeftOpen className="size-4" />}
						{!compact && <PanelLeftClose className="size-4" />}
						{!compact && <span>Recolher</span>}
					</Button>
				</SidebarTooltip>
			</div>
		</aside>
	);
}
