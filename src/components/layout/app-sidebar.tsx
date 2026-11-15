import { Link } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";

import { useNavigationDialogStore } from "@/components/layout/navigation-dialog";
import { SidebarNavContent } from "@/components/layout/sidebar-nav-content";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { Button } from "@/components/ui/button";
import { isDesktop } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { useSidebarNavStore } from "@/stores/sidebar-nav";

export function AppSidebar() {
	const mode = useSidebarNavStore((state) => state.mode);
	const toggleMode = useSidebarNavStore((state) => state.toggleMode);
	const openNavigation = useNavigationDialogStore((state) => state.setOpen);
	const compact = mode === "compact";

	return (
		<aside
			data-component="app-sidebar"
			className={cn(
				"hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex",
				compact ? "w-14" : "w-60",
			)}
		>
			<div
				className={cn(
					"flex h-shell-bar shrink-0 items-center px-4",
					compact && "justify-center px-0",
					isDesktop() && "desktop-drag-region",
				)}
			>
				<Link
					to="/"
					aria-label="Koworker, início"
					className="flex items-center gap-2 text-[15px] font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<span
						aria-hidden
						className="size-6 shrink-0 bg-primary mask-[url('../static/logo.svg')] mask-contain mask-center mask-no-repeat"
					/>
					{!compact && <span>Koworker</span>}
				</Link>
			</div>
			<div className="px-2 pb-3">
				<SidebarTooltip
					label="Buscar página (Ctrl+K)"
					disabled={!compact}
					triggerClassName="flex w-full"
				>
					<button
						type="button"
						onClick={() => openNavigation(true)}
						aria-label="Buscar página"
						aria-haspopup="dialog"
						className={cn(
							"flex h-9 w-full cursor-pointer items-center gap-2 border border-border bg-background text-sm text-sidebar-muted-foreground shadow-xs transition-colors hover:border-input hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
							compact ? "justify-center px-0" : "px-2.5",
						)}
					>
						<Search className="size-4 shrink-0" />
						{!compact && (
							<>
								<span className="flex-1 text-left">Buscar</span>
								<kbd className="font-sans text-[11px] text-muted-foreground">Ctrl K</kbd>
							</>
						)}
					</button>
				</SidebarTooltip>
			</div>
			<div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4">
				<SidebarNavContent variant="sidebar" compact={compact} />
			</div>
			<div className="flex h-shell-foot shrink-0 items-center px-2">
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
