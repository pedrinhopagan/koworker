/**
 * TabBar - Main navigation component
 * Provides: Home, Projetos, Tarefas, Agenda tabs + Settings + Hide button
 * Supports window dragging in Tauri environment
 */

import { Link, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { Brush, FilePlus2, Layers, Menu, RefreshCw, Settings, SquarePen, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { tv } from "tailwind-variants";
import { getActiveTabLabel, MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { SweepInvocationsDialog } from "@/components/layout/sweep-invocations-dialog";
import { isTabActive, tabs } from "@/components/layout/tab-nav-config";
import { NewTaskDialog } from "@/components/prompt-bar/new-task-dialog";
import { NewVaultNoteDialog } from "@/components/prompt-bar/new-vault-note-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { copyToClipboard } from "@/lib/build-prompt";
import { getAppEnv } from "@/lib/env";
import { hideWindow, isTauri, startWindowDrag } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useDocSessionsStore } from "@/stores/doc-sessions";
import { useDocSwitcherStore } from "@/stores/doc-switcher";

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

export function TabBar() {
	const location = useLocation();
	const navigate = useNavigate();
	const routerState = useRouterState();
	const currentPath = location.pathname;
	const toggleShortcutLabel = getAppEnv() === "production" ? "Alt+P" : "Alt+O";
	const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

	const handlePageReload = useCallback(() => {
		window.location.reload();
	}, []);

	const openSwitcher = useDocSwitcherStore((s) => s.open);
	const recents = useDocSessionsStore((s) => s.recents);
	const sessionCount = recents.length;
	const currentKey = useDocSwitcherStore((s) => s.current?.key ?? null);
	const currentInList = currentKey !== null && recents.some((r) => r.key === currentKey);

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
					<NewTaskButton />
				</div>

				<div className="hidden md:contents">
					<NewTaskButton />
					<NewVaultNoteButton />

					<Tooltip label="Sessões de leitura (Alt+`)">
						<button
							type="button"
							onClick={openSwitcher}
							className={cn(iconButton({ active: false }), "relative")}
							aria-label="Sessões de leitura"
						>
							<Layers
								size={16}
								className={
									currentInList ? "text-[var(--project-accent,var(--primary))]" : undefined
								}
							/>
							{sessionCount > 0 ? (
								<span className="absolute top-0.5 right-0.5 z-10 min-w-3.5 rounded-[3px] bg-[var(--project-accent,var(--primary))]/30 px-1 text-center font-semibold text-[10px] text-[var(--project-accent,var(--primary))] leading-[14px]">
									{sessionCount}
								</span>
							) : null}
						</button>
					</Tooltip>

					<SweepInvocationsButton />

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

					<Tooltip label="Configurações (Alt+0)">
						<Link
							to={"/configuracoes" as const}
							className={iconButton({ active: currentPath === "/configuracoes" })}
							aria-label="Configurações"
						>
							<Settings size={16} />
						</Link>
					</Tooltip>

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
				</div>
			</nav>

			<MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
		</>
	);
}

function NewTaskButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Tooltip label="Nova tarefa">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className={iconButton({ active: open })}
					aria-label="Nova tarefa"
				>
					<SquarePen size={16} />
				</button>
			</Tooltip>
			<NewTaskDialog open={open} onClose={() => setOpen(false)} />
		</>
	);
}

function NewVaultNoteButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Tooltip label="Nova nota no vault">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className={iconButton({ active: open })}
					aria-label="Nova nota no vault"
				>
					<FilePlus2 size={16} />
				</button>
			</Tooltip>
			<NewVaultNoteDialog open={open} onClose={() => setOpen(false)} />
		</>
	);
}

function SweepInvocationsButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Tooltip label="Fechar terminais de invocação">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className={iconButton({ active: open })}
					aria-label="Fechar terminais de invocação"
				>
					<Brush size={16} />
				</button>
			</Tooltip>
			<SweepInvocationsDialog open={open} onClose={() => setOpen(false)} />
		</>
	);
}
