import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { getActiveTabLabel, MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { NavigationDialog } from "@/components/layout/navigation-dialog";
import { RoutePathButton } from "@/components/layout/route-path-button";
import { tabs } from "@/components/layout/tab-nav-config";
import { WindowControls } from "@/components/layout/window-controls";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { isDesktop } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { useSidebarNavStore } from "@/stores/sidebar-nav";

export function TabBar({ compact = false }: { compact?: boolean }) {
	const location = useLocation();
	const navigate = useNavigate();
	const router = useRouter();
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [navigationOpen, setNavigationOpen] = useState(false);
	const toggleSidebar = useSidebarNavStore((state) => state.toggleMode);
	const { selectedProject, loading } = useProjectFocus();
	const pageLabel = getActiveTabLabel(location.pathname);
	const projectLabel = selectedProject?.name ?? (loading ? "Carregando..." : "Todos os projetos");

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented) {
				return;
			}

			if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
				if (event.key.toLowerCase() === "k") {
					event.preventDefault();
					setNavigationOpen((open) => !open);
				}
				if (event.key.toLowerCase() === "b") {
					event.preventDefault();
					toggleSidebar();
				}
				return;
			}

			if (!event.altKey || event.key < "0" || event.key > "9") {
				return;
			}

			const tab = tabs.find((item) => item.altKey === event.key);
			if (tab) {
				event.preventDefault();
				void navigate({ to: tab.path });
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [navigate, toggleSidebar]);

	return (
		<>
			<header
				data-component="workspace-header"
				className={cn(
					"flex h-shell-bar shrink-0 items-center gap-2 border-b border-border bg-background px-3 select-none sm:px-4",
					isDesktop() && "desktop-drag-region",
				)}
			>
				<Button
					variant="ghost-muted"
					size="icon-sm"
					onClick={() => setMobileNavOpen(true)}
					className={cn("md:hidden", compact && "md:inline-flex")}
					aria-label="Abrir menu de navegação"
					aria-expanded={mobileNavOpen}
				>
					<Menu className="size-5" />
				</Button>
				<Tooltip label="Voltar">
					<Button
						variant="ghost-muted"
						size="icon-sm"
						onClick={() => router.history.back()}
						disabled={!router.history.canGoBack()}
						aria-label="Voltar à página anterior"
						className={cn("hidden md:inline-flex", compact && "md:hidden")}
					>
						<ArrowLeft className="size-4" />
					</Button>
				</Tooltip>
				<div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
					<span className="hidden max-w-48 truncate text-muted-foreground lg:block">
						{projectLabel}
					</span>
					<ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground/60 lg:block" />
					<span className="truncate font-medium">{pageLabel}</span>
				</div>
				<div className="hidden items-center gap-3 xl:flex">
					<RoutePathButton />
				</div>
				<Tooltip label="Navegar (Ctrl+K)">
					<Button
						variant="ghost-muted"
						size="icon-sm"
						onClick={() => setNavigationOpen(true)}
						aria-label="Buscar página"
						aria-haspopup="dialog"
					>
						<Search className="size-4" />
					</Button>
				</Tooltip>
				<ThemeToggle />
				<WindowControls />
			</header>
			<MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
			<NavigationDialog open={navigationOpen} onClose={() => setNavigationOpen(false)} />
		</>
	);
}
