import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu, SquarePen } from "lucide-react";
import { useEffect, useState } from "react";
import { tv } from "tailwind-variants";
import { getActiveTabLabel, MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { RoutePathButton } from "@/components/layout/route-path-button";
import { isTabActive, tabs, topTabs } from "@/components/layout/tab-nav-config";
import { WindowControls } from "@/components/layout/window-controls";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useNavActionDialogsStore } from "@/hooks/use-nav-action-dialogs";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { isDesktop } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { useSidebarNavStore } from "@/stores/sidebar-nav";

const tabItem = tv({
	base: "px-4 py-2.5 text-sm transition-colors cursor-pointer shadow-[inset_0_-2px_0_transparent]",
	variants: {
		active: {
			true: "text-foreground font-medium shadow-[inset_0_-2px_0_var(--project-accent,var(--primary))]",
			false: "text-muted-foreground hover:text-foreground",
		},
	},
});

export function TabBar({ compact = false }: { compact?: boolean }) {
	const location = useLocation();
	const navigate = useNavigate();
	const currentPath = location.pathname;
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const openActionDialog = useNavActionDialogsStore((s) => s.open);
	const sidebarMode = useSidebarNavStore((s) => s.mode);
	const { selectedProjectId, selectedProject, accent, loading } = useProjectFocus();
	const projectLabel =
		selectedProjectId === undefined
			? "Todos os projetos"
			: (selectedProject?.name ?? (loading ? "Carregando..." : "Selecionar projeto"));

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (!e.altKey || e.key < "0" || e.key > "9") {
				return;
			}

			e.preventDefault();

			const tab = tabs.find((t) => t.altKey === e.key);
			if (tab) {
				navigate({ to: tab.path });
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [navigate]);

	const mobileOnly = cn("flex md:hidden", compact && "md:flex");
	const desktopOnly = cn("hidden md:flex", compact && "md:hidden");

	return (
		<>
			<nav
				className={cn(
					"flex h-12 items-center border-b border-border bg-chrome select-none md:h-auto",
					isDesktop() && "desktop-drag-region cursor-grab active:cursor-grabbing",
				)}
			>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setMobileNavOpen(true)}
					className={cn(mobileOnly, "size-12 text-muted-foreground hover:text-foreground")}
					aria-label="Abrir menu de navegação"
					aria-expanded={mobileNavOpen}
				>
					<Menu className="size-5" />
				</Button>

				<div className={cn(mobileOnly, "min-w-0 flex-1 flex-col justify-center")}>
					<span className="truncate text-sm font-semibold text-foreground">
						{getActiveTabLabel(currentPath)}
					</span>
					<span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
						{accent?.color && (
							<span
								aria-hidden
								className="size-1.5 shrink-0 rounded-full"
								style={{ backgroundColor: accent.color }}
							/>
						)}
						<span className="truncate">{projectLabel}</span>
					</span>
				</div>

				{sidebarMode === "compact" && !compact && (
					<div className="hidden min-w-0 items-center gap-2 self-stretch border-r border-border px-4 md:flex">
						{accent?.color && (
							<span
								aria-hidden
								className="size-2 shrink-0 rounded-sm"
								style={{ backgroundColor: accent.color }}
							/>
						)}
						<span className="max-w-44 truncate text-sm font-medium text-foreground">
							{projectLabel}
						</span>
					</div>
				)}

				<div className={desktopOnly}>
					{topTabs.map((tab) => (
						<Link
							key={tab.path}
							to={tab.path}
							className={tabItem({ active: isTabActive(currentPath, tab.path) })}
							title={`${tab.label} (Alt+${tab.altKey})`}
						>
							{tab.label}
						</Link>
					))}
				</div>

				<div className={cn(desktopOnly, "flex-1 items-center justify-center")}>
					<RoutePathButton />
				</div>

				<Button
					variant="ghost"
					size="icon"
					onClick={() => openActionDialog("newTask")}
					className={cn(mobileOnly, "size-12 text-muted-foreground hover:text-foreground")}
					aria-label="Nova tarefa"
				>
					<SquarePen className="size-5" />
				</Button>

				<div className={cn(desktopOnly, "items-center gap-0.5 pr-1 self-stretch")}>
					<Tooltip label="Nova tarefa">
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={() => openActionDialog("newTask")}
							className="text-muted-foreground hover:text-foreground"
							aria-label="Nova tarefa"
						>
							<SquarePen className="size-4" />
						</Button>
					</Tooltip>
				</div>

				<WindowControls />
			</nav>

			<MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
		</>
	);
}
