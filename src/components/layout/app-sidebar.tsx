import { PanelLeft } from "lucide-react";

import { SidebarNavContent } from "@/components/layout/sidebar-nav-content";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { cn } from "@/lib/utils";
import { useSidebarNavStore } from "@/stores/sidebar-nav";

export function AppSidebar() {
	const mode = useSidebarNavStore((s) => s.mode);
	const toggleMode = useSidebarNavStore((s) => s.toggleMode);
	const compact = mode === "compact";

	const collapseButton = (
		<button
			type="button"
			onClick={toggleMode}
			className={cn(
				"flex h-8 w-full items-center gap-2 border-t border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground",
				compact && "justify-center px-0",
			)}
			aria-label={compact ? "Expandir sidebar" : "Recolher sidebar"}
		>
			<PanelLeft size={14} />
			{compact ? null : <span className="truncate">← Esconder</span>}
		</button>
	);

	return (
		<aside
			className={cn(
				"hidden md:flex shrink-0 flex-col border-r border-border bg-chrome transition-[width] duration-200",
				compact ? "w-12" : "w-44",
			)}
		>
			<div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-2">
				<SidebarNavContent variant="sidebar" compact={compact} />
			</div>

			{compact ? (
				<SidebarTooltip label="Esconder" triggerClassName="flex w-full">
					{collapseButton}
				</SidebarTooltip>
			) : (
				collapseButton
			)}
		</aside>
	);
}
