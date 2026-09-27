import { Link, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { AgentWaitingBadge, AgentWorkingPulse } from "@/components/layout/agent-nav-indicators";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { sidebarNavGroups, type SidebarNavRouteItem } from "@/components/layout/sidebar-nav-config";
import { isTabActive } from "@/components/layout/tab-nav-config";
import { useAgentRadarAttention } from "@/hooks/use-agent-radar";

const mobileRouteOrder = ["/", "/projetos", "/shells", "/tarefas"];
const mobileRoutes = sidebarNavGroups
	.flatMap((group) => group.items)
	.filter(
		(item): item is SidebarNavRouteItem =>
			item.kind === "route" && mobileRouteOrder.includes(item.path),
	)
	.sort(
		(left, right) => mobileRouteOrder.indexOf(left.path) - mobileRouteOrder.indexOf(right.path),
	);

export function MobileBottomNav() {
	const { pathname } = useLocation();
	const [menuOpen, setMenuOpen] = useState(false);
	const radar = useAgentRadarAttention();
	const routeIndex = mobileRoutes.findIndex((item) => isTabActive(pathname, item.path));
	const activeIndex = menuOpen || routeIndex === -1 ? mobileRoutes.length : routeIndex;
	const shellStatus = [
		radar.waiting > 0 ? `${radar.waiting} esperando você` : "",
		radar.working > 0 ? `${radar.working} trabalhando` : "",
	]
		.filter(Boolean)
		.join(", ");

	return (
		<>
			<nav
				aria-label="Navegação principal"
				className="mobile-bottom-nav grid h-16 shrink-0 grid-cols-5 border-t border-border bg-chrome"
			>
				{mobileRoutes.map((item, index) => {
					const Icon = item.icon;
					const active = activeIndex === index;
					const isShells = item.path === "/shells";

					return (
						<Link
							key={item.path}
							to={item.path}
							aria-label={isShells && shellStatus ? `Shells: ${shellStatus}` : undefined}
							aria-current={isTabActive(pathname, item.path) ? "page" : undefined}
							data-active={active}
							className="mobile-bottom-nav-item"
						>
							<span className="relative inline-flex">
								<Icon aria-hidden data-waiting={isShells && radar.waiting > 0} className="size-5" />
								{isShells && <AgentWaitingBadge count={radar.waiting} layout="compact" />}
							</span>
							<span className="flex items-center gap-1 text-[11px] leading-4">
								{item.path === "/" ? "Início" : item.label}
								{isShells && <AgentWorkingPulse count={radar.working} layout="expanded" />}
							</span>
						</Link>
					);
				})}
				<button
					type="button"
					aria-label="Mais navegações"
					aria-expanded={menuOpen}
					aria-haspopup="dialog"
					data-active={activeIndex === mobileRoutes.length}
					onClick={() => setMenuOpen(true)}
					className="mobile-bottom-nav-item"
				>
					<Menu aria-hidden className="size-5" />
					<span className="text-[11px] leading-4">Mais</span>
				</button>
			</nav>
			<MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
		</>
	);
}
