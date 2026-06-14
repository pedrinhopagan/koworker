/**
 * TabBar - Main navigation component
 * Provides: Home, Projetos, Tarefas, Agenda tabs + Settings + Hide button
 * Supports window dragging in Tauri environment
 */

import { Link, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { Layers, RefreshCw, Settings, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { tv } from "tailwind-variants";
import { Tooltip } from "@/components/ui/tooltip";
import { getAppEnv } from "@/lib/env";
import { hideWindow, isTauri, startWindowDrag } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useDocSessionsStore } from "@/stores/doc-sessions";
import { useDocSwitcherStore } from "@/stores/doc-switcher";

// Navigation tabs configuration
type TabPath = "/" | "/projetos" | "/tarefas" | "/vault" | "/agenda" | "/skills" | "/agents";
type Tab = { path: TabPath; label: string; altKey: string };

const tabs: Tab[] = [
	{ path: "/", label: "Home", altKey: "1" },
	{ path: "/projetos", label: "Projetos", altKey: "2" },
	{ path: "/tarefas", label: "Tarefas", altKey: "3" },
	{ path: "/vault", label: "Vault", altKey: "4" },
	{ path: "/agenda", label: "Agenda", altKey: "5" },
	{ path: "/skills", label: "Skills", altKey: "6" },
	{ path: "/agents", label: "Agents", altKey: "7" },
];

// Tab item styles
const tabItem = tv({
	base: "px-4 py-2.5 text-sm transition-colors cursor-pointer shadow-[inset_0_-2px_0_transparent]",
	variants: {
		active: {
			true: "text-foreground font-medium shadow-[inset_0_-2px_0_var(--project-accent,var(--primary))]",
			false: "text-muted-foreground hover:text-foreground",
		},
	},
});

// Icon button styles
const iconButton = tv({
	base: "px-3 py-2 text-sm transition-colors cursor-pointer",
	variants: {
		active: {
			true: "text-primary",
			false: "text-muted-foreground hover:text-foreground",
		},
		danger: {
			true: "hover:text-destructive",
		},
	},
});

function isTabActive(currentPath: string, tabPath: string): boolean {
	if (tabPath === "/") {
		return currentPath === "/" || currentPath === "/home";
	}
	return currentPath === tabPath || currentPath.startsWith(`${tabPath}/`);
}

export function TabBar() {
	const location = useLocation();
	const navigate = useNavigate();
	const routerState = useRouterState();
	const currentPath = location.pathname;
	const toggleShortcutLabel = getAppEnv() === "production" ? "Alt+P" : "Alt+O";

	// Keyboard navigation: Alt+1-7 for tabs, Alt+0 for settings
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

	// Window drag handler for Tauri
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		startWindowDrag(e);
	}, []);

	const handlePageReload = useCallback(() => {
		window.location.reload();
	}, []);

	const openSwitcher = useDocSwitcherStore((s) => s.open);
	const recents = useDocSessionsStore((s) => s.recents);
	const sessionCount = recents.length;
	// Ícone na cor do projeto quando o doc em foco já entrou nas sessões — espelha o acento do badge.
	const currentKey = useDocSwitcherStore((s) => s.current?.key ?? null);
	const currentInList = currentKey !== null && recents.some((r) => r.key === currentKey);

	// Current route path for debug display (optional)
	const currentRoutePath = routerState.matches.at(-1)?.fullPath ?? "/";

	return (
		<nav
			className={cn(
				"flex items-center border-b gap-4 border-border bg-chrome select-none",
				isTauri() && "cursor-grab active:cursor-grabbing",
			)}
			onMouseDown={handleMouseDown}
		>
			{/* Logo */}
			{/*<div className="px-3 py-2 flex items-center">
				<img
					src="/static/logo.svg"
					alt="Kowork"
					title="Kowork"
					className="w-5 h-5 "
				/>
			</div>*/}

			{/* Main tabs */}
			<div className="flex">
				{tabs.map((tab) => (
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

			{/* Spacer with route path debug info */}
			<div className="flex-1 text-center">
				<span className="text-xs text-muted-foreground opacity-30">{currentRoutePath}</span>
			</div>

			{/* Switcher de sessões de leitura (Alt+`). O contador conta o MRU; abrir o switcher (ou o
			    dwell) grava o doc em foco, e aí o ícone também assume o acento do projeto. */}
			<Tooltip label="Sessões de leitura (Alt+`)">
				<button
					type="button"
					onClick={openSwitcher}
					className={cn(iconButton({ active: false }), "relative")}
					aria-label="Sessões de leitura"
				>
					<Layers
						size={16}
						className={currentInList ? "text-[var(--project-accent,var(--primary))]" : undefined}
					/>
					{sessionCount > 0 ? (
						<span className="absolute top-0.5 right-0.5 z-10 min-w-3.5 rounded-[3px] bg-[var(--project-accent,var(--primary))]/30 px-1 text-center font-semibold text-[10px] text-[var(--project-accent,var(--primary))] leading-[14px]">
							{sessionCount}
						</span>
					) : null}
				</button>
			</Tooltip>

			{/* Settings button */}
			<Tooltip label="Atualizar dados da página">
				<button
					type="button"
					onClick={handlePageReload}
					className={iconButton({ active: false })}
					aria-label="Atualizar dados da página"
				>
					<RefreshCw size={16} />
				</button>
			</Tooltip>

			{/* Settings button */}
			<Tooltip label="Configurações (Alt+0)">
				<Link
					to={"/configuracoes" as const}
					className={iconButton({ active: currentPath === "/configuracoes" })}
					aria-label="Configurações"
				>
					<Settings size={16} />
				</Link>
			</Tooltip>

			{/* Hide button (Tauri only) */}
			{isTauri() && (
				<Tooltip label={`Esconder (${toggleShortcutLabel} para mostrar)`}>
					<button
						type="button"
						onClick={hideWindow}
						className={iconButton({ danger: true })}
						aria-label="Esconder"
					>
						<X size={16} />
					</button>
				</Tooltip>
			)}
		</nav>
	);
}
