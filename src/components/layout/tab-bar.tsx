import { useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, FolderKanban, Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { NavigationDialog } from "@/components/layout/navigation-dialog";
import { RoutePathButton } from "@/components/layout/route-path-button";
import { tabs } from "@/components/layout/tab-nav-config";
import { WorkspaceBreadcrumbs } from "@/components/layout/workspace-breadcrumbs";
import { WindowControls } from "@/components/layout/window-controls";
import { useProjectSelectDialogStore } from "@/hooks/use-project-select-dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { isDesktop } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { useSidebarNavStore } from "@/stores/sidebar-nav";

export function TabBar({ compact = false }: { compact?: boolean }) {
	const navigate = useNavigate();
	const router = useRouter();
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [navigationOpen, setNavigationOpen] = useState(false);
	const openProjectDialog = useProjectSelectDialogStore((state) => state.openDialog);
	const toggleSidebar = useSidebarNavStore((state) => state.toggleMode);
	const { selectedProject, loading } = useProjectFocus();
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
					"flex h-shell-bar shrink-0 items-center gap-2 border-b border-border bg-background px-3 select-none sm:px-4 [&_button]:border-0 [&_button]:shadow-none",
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
				<WorkspaceBreadcrumbs />
				<div className="hidden sm:block">
					<RoutePathButton />
				</div>
				<Tooltip label={`Selecionar projeto: ${projectLabel}`}>
					<Button
						variant="ghost-muted"
						size="icon-sm"
						onClick={openProjectDialog}
						className="hidden sm:inline-flex"
						aria-label={`Selecionar projeto: ${projectLabel}`}
					>
						<FolderKanban className="size-4" />
					</Button>
				</Tooltip>
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
