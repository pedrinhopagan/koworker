import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import {
	drawerTopRoutes,
	formatSidebarShortcut,
	isSidebarRouteActive,
	sidebarNavGroups,
	sidebarSelectProjectItem,
	type SidebarNavActionItem,
	type SidebarNavItem,
	type SidebarNavRouteItem,
} from "@/components/layout/sidebar-nav-config";
import { Tooltip } from "@/components/ui/tooltip";
import { useProjectFocus } from "@/hooks";
import { useNavActionDialogsStore } from "@/hooks/use-nav-action-dialogs";
import { useProjectSelectDialogStore } from "@/hooks/use-project-select-dialog";
import { hideWindow, isTauri } from "@/lib/tauri";
import { getWindowToggleShortcutTooltip } from "@/lib/window-shortcut";
import { cn } from "@/lib/utils";
import { useDocSessionsStore } from "@/stores/doc-sessions";
import { useDocSwitcherStore } from "@/stores/doc-switcher";

type SidebarNavContentProps = {
	variant: "sidebar" | "drawer";
	compact?: boolean;
	onNavigate?: () => void;
};

const sidebarItem = tv({
	base: "w-full transition-colors cursor-pointer",
	variants: {
		active: {
			true: "text-foreground font-medium bg-muted/50",
			false: "text-muted-foreground hover:text-foreground hover:bg-muted/30",
		},
		layout: {
			compact: "flex items-center justify-center p-2.5",
			expanded: "flex items-center gap-3 px-3 py-2.5",
			drawer: "flex min-h-12 items-center gap-3 px-5 py-3 text-base",
		},
		danger: {
			true: "hover:text-destructive",
		},
	},
});

export function SidebarNavContent({
	variant,
	compact = false,
	onNavigate,
}: SidebarNavContentProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const currentPath = location.pathname;
	const toggleShortcutTooltip = getWindowToggleShortcutTooltip();

	const { selectedProjectId, selectedProject, accent, loading } = useProjectFocus();
	const openProjectDialog = useProjectSelectDialogStore((s) => s.openDialog);

	const projectLabel =
		selectedProjectId === undefined
			? "Todos os projetos"
			: (selectedProject?.name ?? (loading ? "Carregando..." : "Selecionar projeto"));

	const openSwitcher = useDocSwitcherStore((s) => s.open);
	const recents = useDocSessionsStore((s) => s.recents);
	const sessionCount = recents.length;
	const currentKey = useDocSwitcherStore((s) => s.current?.key ?? null);
	const currentInList = currentKey !== null && recents.some((r) => r.key === currentKey);

	const openActionDialog = useNavActionDialogsStore((s) => s.open);

	const layout = variant === "drawer" ? "drawer" : compact ? "compact" : "expanded";
	const iconSize = variant === "drawer" ? 18 : 15;

	function handleRouteNavigate(path: string) {
		onNavigate?.();
		navigate({ to: path });
	}

	function handleAction(action: SidebarNavActionItem) {
		switch (action.id) {
			case "openSwitcher":
				onNavigate?.();
				openSwitcher();
				break;
			case "newVaultNote":
				onNavigate?.();
				openActionDialog("newVaultNote");
				break;
			case "newTask":
				onNavigate?.();
				openActionDialog("newTask");
				break;
			case "refreshPage":
				onNavigate?.();
				window.location.reload();
				break;
			case "sweepInvocations":
				onNavigate?.();
				openActionDialog("sweepInvocations");
				break;
			case "hideWindow":
				onNavigate?.();
				hideWindow();
				break;
		}
	}

	function getTooltipLabel(item: SidebarNavItem): string | undefined {
		const shortcut =
			item.kind === "selectProject"
				? formatSidebarShortcut(item.altKey)
				: formatSidebarShortcut(item.kind === "route" ? item.altKey : item.altKey);

		if (variant === "drawer") {
			return undefined;
		}

		if (item.kind === "selectProject") {
			return compact ? `${projectLabel} (${shortcut})` : shortcut;
		}

		if (compact) {
			if (item.kind === "action" && item.id === "hideWindow") {
				return `${item.label} (${toggleShortcutTooltip})`;
			}
			return shortcut ? `${item.label} (${shortcut})` : item.label;
		}

		if (shortcut) {
			return shortcut;
		}

		if (item.kind === "action" && item.id === "hideWindow") {
			return toggleShortcutTooltip;
		}

		return undefined;
	}

	function renderSelectProjectItem() {
		const item = sidebarSelectProjectItem;
		const className = sidebarItem({ active: false, layout });
		const Icon = item.icon;
		const tooltip = getTooltipLabel(item);
		const accentColor = accent?.color ?? null;

		const content = (
			<>
				{accentColor ? (
					<span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: accentColor }} />
				) : (
					<Icon size={iconSize} />
				)}
				{layout === "compact" ? null : (
					<span className="min-w-0 truncate text-sm">{projectLabel}</span>
				)}
				{layout === "drawer" ? (
					<span className="ml-auto text-xs text-muted-foreground">Alt+{item.altKey}</span>
				) : null}
			</>
		);

		const button = (
			<button
				type="button"
				onClick={() => {
					onNavigate?.();
					openProjectDialog();
				}}
				className={className}
				aria-label={item.label}
			>
				{content}
			</button>
		);

		if (!tooltip) {
			return button;
		}

		return (
			<Tooltip label={tooltip} triggerClassName="flex w-full">
				{button}
			</Tooltip>
		);
	}

	function renderRouteItem(item: SidebarNavRouteItem) {
		const active = isSidebarRouteActive(currentPath, item.path);
		const className = sidebarItem({ active, layout });
		const Icon = item.icon;
		const tooltip = getTooltipLabel(item);

		const content = (
			<>
				<Icon size={iconSize} />
				{layout === "compact" ? null : <span className="truncate text-sm">{item.label}</span>}
				{layout === "drawer" && item.altKey ? (
					<span className="ml-auto text-xs text-muted-foreground">Alt+{item.altKey}</span>
				) : null}
			</>
		);

		if (variant === "drawer") {
			return (
				<button
					key={item.path}
					type="button"
					onClick={() => handleRouteNavigate(item.path)}
					className={className}
				>
					{content}
				</button>
			);
		}

		const link = (
			<Link key={item.path} to={item.path} className={className} aria-label={item.label}>
				{content}
			</Link>
		);

		if (!tooltip) {
			return link;
		}

		return (
			<Tooltip key={item.path} label={tooltip} triggerClassName="flex w-full">
				{link}
			</Tooltip>
		);
	}

	function renderActionItem(item: SidebarNavActionItem) {
		if (item.tauriOnly && !isTauri()) {
			return null;
		}

		const isSwitcher = item.id === "openSwitcher";
		const active = isSwitcher && currentInList;
		const className = cn(
			sidebarItem({ active: false, layout, danger: item.id === "hideWindow" }),
			active && "text-[var(--project-accent,var(--primary))]",
		);
		const Icon = item.icon;
		const tooltip = getTooltipLabel(item);

		const content = (
			<>
				<span className={cn("relative inline-flex", layout === "compact" && "justify-center")}>
					<Icon
						size={iconSize}
						className={active ? "text-[var(--project-accent,var(--primary))]" : undefined}
					/>
					{isSwitcher && sessionCount > 0 ? (
						<span
							className={cn(
								"absolute z-10 min-w-3 rounded-[3px] bg-[var(--project-accent,var(--primary))]/30 px-0.5 text-center font-semibold text-[8px] text-[var(--project-accent,var(--primary))] leading-[11px]",
								layout === "compact" ? "-top-1.5 -right-1.5" : "-top-2 -right-2",
							)}
						>
							{sessionCount}
						</span>
					) : null}
				</span>
				{layout === "compact" ? null : <span className="truncate text-sm">{item.label}</span>}
				{layout === "drawer" && isSwitcher ? (
					sessionCount > 0 ? (
						<span className="ml-auto min-w-5 rounded bg-muted px-1.5 text-center text-xs font-semibold text-foreground">
							{sessionCount}
						</span>
					) : item.altKey ? (
						<span className="ml-auto text-xs text-muted-foreground">Alt+{item.altKey}</span>
					) : null
				) : null}
			</>
		);

		const button = (
			<button
				key={item.id}
				type="button"
				onClick={() => handleAction(item)}
				className={className}
				aria-label={item.label}
			>
				{content}
			</button>
		);

		if (!tooltip) {
			return button;
		}

		return (
			<Tooltip key={item.id} label={tooltip} triggerClassName="flex w-full">
				{button}
			</Tooltip>
		);
	}

	function renderItem(item: SidebarNavItem) {
		if (item.kind === "selectProject") {
			return renderSelectProjectItem();
		}
		if (item.kind === "route") {
			return renderRouteItem(item);
		}
		return renderActionItem(item);
	}

	return (
		<>
			<nav className={cn(variant === "drawer" && "-mx-5 -mt-5 flex flex-col")}>
				{renderSelectProjectItem()}
				<div className="mb-2 border-t border-border" />
				{variant === "drawer" ? <div>{drawerTopRoutes.map(renderItem)}</div> : null}
				{sidebarNavGroups.map((group, groupIndex) => (
					<div key={groupIndex}>
						{groupIndex > 0 || variant === "drawer" ? (
							<div className="my-2 border-t border-border" />
						) : null}
						{group.items.map(renderItem)}
					</div>
				))}
			</nav>
		</>
	);
}
