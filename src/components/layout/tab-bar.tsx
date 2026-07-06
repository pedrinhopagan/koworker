/**
 * TabBar - Main navigation component
 * Desktop: Home, Projetos, Tarefas + copiar rota no centro
 * Mobile: hamburger + título da rota + Nova nota no vault
 * Supports window dragging in Tauri environment
 */

import { Link, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, SquarePen, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { tv } from "tailwind-variants";
import { getActiveTabLabel, MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { NewVaultNoteButton } from "@/components/layout/sidebar-nav-actions";
import { isTabActive, tabs, topTabs } from "@/components/layout/tab-nav-config";
import { Tooltip } from "@/components/ui/tooltip";
import { useNavActionDialogsStore } from "@/hooks/use-nav-action-dialogs";
import { copyToClipboard } from "@/lib/build-prompt";
import { hideWindow, isTauri, startWindowDrag } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { getWindowToggleShortcutTooltip } from "@/lib/window-shortcut";

const tabItem = tv({
	base: "px-4 py-2.5 text-sm transition-colors cursor-pointer shadow-[inset_0_-2px_0_transparent]",
	variants: {
		active: {
			true: "text-foreground font-medium shadow-[inset_0_-2px_0_var(--project-accent,var(--primary))]",
			false: "text-muted-foreground hover:text-foreground",
		},
	},
});

const iconButton = tv({
	base: "px-3 py-2 text-sm transition-colors cursor-pointer text-muted-foreground hover:text-foreground",
	variants: {
		active: {
			true: "text-primary",
		},
	},
});

export function TabBar() {
	const location = useLocation();
	const navigate = useNavigate();
	const routerState = useRouterState();
	const currentPath = location.pathname;
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const openActionDialog = useNavActionDialogsStore((s) => s.open);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (!e.altKey || e.key < "0" || e.key > "9") {
				return;
			}

			e.preventDefault();

			if (e.key === "0") {
				navigate({ to: "/configuracoes" as string });
				return;
			}

			const tab = tabs.find((t) => t.altKey === e.key);
			if (tab) {
				navigate({ to: tab.path });
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [navigate]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		startWindowDrag(e);
	}, []);

	const currentRoutePath = routerState.matches.at(-1)?.fullPath ?? "/";

	async function handleCopyRoutePath() {
		const ok = await copyToClipboard(currentRoutePath);
		toast[ok ? "success" : "error"](ok ? "Rota copiada" : "Falha ao copiar rota");
	}

	return (
		<>
			<nav
				className={cn(
					"flex items-center border-b gap-2 md:gap-4 border-border bg-chrome select-none",
					isTauri() && "cursor-grab active:cursor-grabbing",
				)}
				onMouseDown={handleMouseDown}
			>
				<button
					type="button"
					onClick={() => setMobileNavOpen(true)}
					className={cn(
						iconButton({ active: mobileNavOpen }),
						"md:hidden min-h-12 min-w-12 px-4 py-3",
					)}
					aria-label="Abrir menu de navegação"
				>
					<Menu size={20} />
				</button>

				<div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground md:hidden">
					{getActiveTabLabel(currentPath)}
				</div>

				<div className="hidden md:flex">
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

				<div className="hidden md:block flex-1 text-center">
					<Tooltip label="Copiar o padrão da rota">
						<button
							type="button"
							onClick={() => void handleCopyRoutePath()}
							className="text-xs text-muted-foreground opacity-30 transition-opacity hover:opacity-70"
						>
							{currentRoutePath}
						</button>
					</Tooltip>
				</div>

				<div className="md:hidden">
					<NewVaultNoteButton
						className={cn(iconButton(), "min-h-12 min-w-12 px-4 py-3")}
						iconSize={20}
					/>
				</div>

				{/* Réplica desktop das ações de "nova tarefa" e "esconder janela": nova tarefa abre o
				    dialog global (já montado no AppShell); esconder janela só no Tauri, como na sidebar. */}
				<div className="hidden items-center pr-1 md:flex">
					<Tooltip label="Nova tarefa">
						<button
							type="button"
							onClick={() => openActionDialog("newTask")}
							className={iconButton()}
							aria-label="Nova tarefa"
						>
							<SquarePen size={16} />
						</button>
					</Tooltip>
					{isTauri() ? (
						<Tooltip label={`Esconder janela — ${getWindowToggleShortcutTooltip()}`}>
							<button
								type="button"
								onClick={() => hideWindow()}
								className={cn(iconButton(), "hover:text-destructive")}
								aria-label="Esconder janela"
							>
								<X size={16} />
							</button>
						</Tooltip>
					) : null}
				</div>
			</nav>

			<MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
		</>
	);
}
