import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown } from "lucide-react";
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
	base: "w-full rounded-[var(--control-radius)] text-left text-sm transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	variants: {
		active: {
			true: "text-sidebar-foreground font-medium bg-sidebar-row-selected shadow-xs",
			false:
				"text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-row-hover",
		},
		layout: {
			compact: "flex h-9 items-center justify-center px-2",
			expanded: "flex h-8 items-center gap-2.5 px-2.5",
			drawer: "flex min-h-12 items-center gap-3 px-3 py-3 text-base",
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
	const iconSize = variant === "drawer" ? 18 : 16;

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
			"border border-border bg-sidebar-row-selected text-sidebar-foreground",
			layout !== "drawer" && "h-10 py-0",
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
					<>
						<span className="min-w-0 flex-1 truncate text-sm">{projectLabel}</span>
						<ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
					</>
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
			<Link
				key={item.path}
				to={item.path}
				className={className}
				aria-label={item.label}
				aria-current={active ? "page" : undefined}
			>
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
		<nav
			aria-label="Navegação principal"
			className={cn("flex flex-col gap-4 px-2", variant === "drawer" && "-mx-3")}
		>
			{renderSelectProjectItem()}
			<div className="flex flex-col gap-4">
				{sidebarNavGroups.map((group) => (
					<div key={group.label} className="flex flex-col gap-0.5">
						{layout === "compact" ? (
							<div className="h-1.5" />
						) : (
							<Text
								as="div"
								size="xs"
								tone="muted"
								className={cn(
									"pb-1.5 text-sidebar-muted-foreground font-medium select-none",
									layout === "drawer" ? "px-3" : "px-2.5",
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
	);
}
