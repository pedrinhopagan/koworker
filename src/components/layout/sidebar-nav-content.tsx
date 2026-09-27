import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import { AgentWaitingBadge, AgentWorkingPulse } from "@/components/layout/agent-nav-indicators";
import {
	formatSidebarShortcut,
	isSidebarRouteActive,
	sidebarNavGroups,
	sidebarSelectProjectItem,
	type SidebarNavItem,
	type SidebarNavRouteItem,
} from "@/components/layout/sidebar-nav-config";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { Text } from "@/components/typography";
import { useProjectFocus } from "@/hooks";
import { useAgentRadarAttention } from "@/hooks/use-agent-radar";
import { useProjectSelectDialogStore } from "@/hooks/use-project-select-dialog";
import { cn } from "@/lib/utils";

type SidebarNavContentProps = {
	variant: "sidebar" | "drawer";
	compact?: boolean;
	onNavigate?: () => void;
};

const sidebarItem = tv({
	base: "w-full transition-colors cursor-pointer",
	variants: {
		active: {
			true: "text-foreground font-medium bg-[var(--project-accent-soft)] shadow-[inset_2px_0_0_var(--project-accent,var(--primary))]",
			false: "text-muted-foreground hover:text-foreground hover:bg-muted/30",
		},
		layout: {
			compact: "flex items-center justify-center p-2.5",
			expanded: "flex items-center gap-3 px-3 py-2.5",
			drawer: "flex min-h-12 items-center gap-3 px-5 py-3 text-base",
		},
	},
});

type SidebarLayout = "compact" | "expanded" | "drawer";

export function SidebarNavContent({
	variant,
	compact = false,
	onNavigate,
}: SidebarNavContentProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const currentPath = location.pathname;

	const { selectedProjectId, selectedProject, accent, loading } = useProjectFocus();
	const openProjectDialog = useProjectSelectDialogStore((s) => s.openDialog);

	const projectLabel =
		selectedProjectId === undefined
			? "Todos os projetos"
			: (selectedProject?.name ?? (loading ? "Carregando..." : "Selecionar projeto"));

	const radar = useAgentRadarAttention();

	const layout: SidebarLayout = variant === "drawer" ? "drawer" : compact ? "compact" : "expanded";
	const iconSize = variant === "drawer" ? 18 : 15;

	function handleRouteNavigate(path: string) {
		onNavigate?.();
		navigate({ to: path });
	}

	function getTooltipLabel(item: SidebarNavItem): string | undefined {
		const shortcut = formatSidebarShortcut(item.altKey);

		if (variant === "drawer") {
			return undefined;
		}

		if (item.kind === "selectProject") {
			return compact ? `${projectLabel} (${shortcut})` : shortcut;
		}

		if (compact) {
			return shortcut ? `${item.label} (${shortcut})` : item.label;
		}

		if (shortcut) {
			return shortcut;
		}

		return undefined;
	}

	function renderSelectProjectItem() {
		const item = sidebarSelectProjectItem;
		const isCompact = layout === "compact";
		const className = cn(
			sidebarItem({ active: false, layout }),
			"border-b border-border",
			layout !== "drawer" && "h-shell-bar py-0",
		);
		const Icon = item.icon;
		const tooltip = getTooltipLabel(item);
		const accentColor = accent?.color ?? null;

		const content = (
			<>
				{accentColor ? (
					<span
						className={cn("shrink-0 rounded-sm", isCompact ? "size-3.5" : "size-2.5")}
						style={{ backgroundColor: accentColor }}
					/>
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
			<SidebarTooltip label={tooltip} triggerClassName="flex w-full">
				{button}
			</SidebarTooltip>
		);
	}

	function renderRouteItem(item: SidebarNavRouteItem) {
		const active = isSidebarRouteActive(currentPath, item.path);
		const className = sidebarItem({ active, layout });
		const Icon = item.icon;
		const isShells = item.path === "/shells";
		const waiting = isShells ? radar.waiting : 0;
		const working = isShells ? radar.working : 0;
		const tooltip =
			waiting > 0
				? `${item.label}: ${waiting} esperando você`
				: working > 0
					? `${item.label}: ${working} trabalhando`
					: getTooltipLabel(item);

		const content = (
			<>
				<span className={cn("relative inline-flex", layout === "compact" && "justify-center")}>
					<Icon size={iconSize} className={waiting > 0 ? "text-warning" : undefined} />
					{layout !== "drawer" && <AgentWaitingBadge count={waiting} layout={layout} />}
					{layout === "compact" && <AgentWorkingPulse layout={layout} count={working} />}
				</span>
				{layout !== "compact" && (
					<span className="flex min-w-0 items-center gap-2">
						<span className="truncate text-sm">{item.label}</span>
						<AgentWorkingPulse layout={layout} count={working} />
					</span>
				)}
				{layout === "drawer" && waiting > 0 ? (
					<AgentWaitingBadge count={waiting} layout={layout} />
				) : layout === "drawer" && item.altKey ? (
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
			<SidebarTooltip key={item.path} label={tooltip} triggerClassName="flex w-full">
				{link}
			</SidebarTooltip>
		);
	}

	function renderItem(item: SidebarNavItem) {
		if (item.kind === "selectProject") {
			return renderSelectProjectItem();
		}
		return renderRouteItem(item);
	}

	return (
		<>
			<nav className={cn(variant === "drawer" && "-mx-5 -mt-5 flex flex-col")}>
				{renderSelectProjectItem()}
				<div className="divide-y divide-border">
					{sidebarNavGroups.map((group) => (
						<div key={group.label} className="pb-1">
							{layout === "compact" ? (
								<div className="h-1.5" />
							) : (
								<Text
									as="div"
									size="xs"
									tone="faint"
									className={cn(
										"pt-3 pb-1 font-semibold uppercase tracking-[0.14em] select-none",
										layout === "drawer" ? "px-5" : "px-3",
									)}
								>
									{group.label}
								</Text>
							)}
							{group.items.map(renderItem)}
						</div>
					))}
				</div>
			</nav>
		</>
	);
}
