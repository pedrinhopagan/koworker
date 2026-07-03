import { useLocation, useNavigate } from "@tanstack/react-router";
import { Brush, FilePlus2, Layers, RefreshCw, Settings, X } from "lucide-react";
import { useState } from "react";
import { tv } from "tailwind-variants";
import { SweepInvocationsDialog } from "@/components/layout/sweep-invocations-dialog";
import { isTabActive, tabs } from "@/components/layout/tab-nav-config";
import { NewVaultNoteDialog } from "@/components/prompt-bar/new-vault-note-dialog";
import { Drawer } from "@/components/ui/drawer";
import { getAppEnv } from "@/lib/env";
import { hideWindow, isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useDocSessionsStore } from "@/stores/doc-sessions";
import { useDocSwitcherStore } from "@/stores/doc-switcher";

type MobileNavDrawerProps = {
	open: boolean;
	onClose: () => void;
};

const navItem = tv({
	base: "flex min-h-12 items-center gap-3 px-5 py-3 text-base transition-colors",
	variants: {
		active: {
			true: "font-medium text-foreground bg-muted/50",
			false: "text-muted-foreground hover:text-foreground hover:bg-muted/30",
		},
	},
});

const actionItem = tv({
	base: "flex min-h-12 w-full items-center gap-3 px-5 py-3 text-base text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground",
});

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const currentPath = location.pathname;
	const toggleShortcutLabel = getAppEnv() === "production" ? "Alt+P" : "Alt+O";

	const openSwitcher = useDocSwitcherStore((s) => s.open);
	const recents = useDocSessionsStore((s) => s.recents);
	const sessionCount = recents.length;

	const [newVaultNoteOpen, setNewVaultNoteOpen] = useState(false);
	const [sweepOpen, setSweepOpen] = useState(false);

	function handleNavigate(path: string) {
		onClose();
		navigate({ to: path });
	}

	function handlePageReload() {
		onClose();
		window.location.reload();
	}

	function handleOpenSwitcher() {
		onClose();
		openSwitcher();
	}

	function handleNewVaultNote() {
		onClose();
		setNewVaultNoteOpen(true);
	}

	function handleSweep() {
		onClose();
		setSweepOpen(true);
	}

	function handleHide() {
		onClose();
		hideWindow();
	}

	return (
		<>
			<Drawer open={open} onClose={onClose} side="left" title="Navegação">
				<nav className="-mx-5 -mt-5 flex flex-col">
					{tabs.map((tab) => (
						<button
							key={tab.path}
							type="button"
							onClick={() => handleNavigate(tab.path)}
							className={navItem({ active: isTabActive(currentPath, tab.path) })}
						>
							{tab.label}
							<span className="ml-auto text-xs text-muted-foreground">Alt+{tab.altKey}</span>
						</button>
					))}

					<div className="my-3 border-t border-border" />

					<div className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Ações
					</div>

					<button type="button" onClick={handleNewVaultNote} className={actionItem()}>
						<FilePlus2 size={18} />
						Nova nota no vault
					</button>

					<button
						type="button"
						onClick={handleOpenSwitcher}
						className={cn(actionItem(), "relative")}
					>
						<Layers size={18} />
						Sessões de leitura
						{sessionCount > 0 ? (
							<span className="ml-auto min-w-5 rounded bg-muted px-1.5 text-center text-xs font-semibold text-foreground">
								{sessionCount}
							</span>
						) : null}
					</button>

					<button type="button" onClick={handleSweep} className={actionItem()}>
						<Brush size={18} />
						Fechar terminais de invocação
					</button>

					<button type="button" onClick={handlePageReload} className={actionItem()}>
						<RefreshCw size={18} />
						Atualizar dados da página
					</button>

					<button
						type="button"
						onClick={() => handleNavigate("/configuracoes")}
						className={actionItem()}
					>
						<Settings size={18} />
						Configurações
					</button>

					{isTauri() && (
						<button
							type="button"
							onClick={handleHide}
							className={cn(actionItem(), "text-destructive")}
						>
							<X size={18} />
							Esconder ({toggleShortcutLabel})
						</button>
					)}
				</nav>
			</Drawer>

			<NewVaultNoteDialog open={newVaultNoteOpen} onClose={() => setNewVaultNoteOpen(false)} />
			<SweepInvocationsDialog open={sweepOpen} onClose={() => setSweepOpen(false)} />
		</>
	);
}

export function getActiveTabLabel(currentPath: string): string {
	const active = tabs.find((tab) => isTabActive(currentPath, tab.path));
	return active?.label ?? "Menu";
}
