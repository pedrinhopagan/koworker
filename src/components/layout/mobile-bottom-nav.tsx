import { Link, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { AgentWaitingBadge, AgentWorkingPulse } from "@/components/layout/agent-nav-indicators";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { sidebarNavGroups, type SidebarNavRouteItem } from "@/components/layout/sidebar-nav-config";
import { isTabActive } from "@/components/layout/tab-nav-config";
import { useChatAttention } from "@/hooks/use-chat-attention";

const mobileRouteOrder = ["/", "/projetos", "/tarefas", "/chat"];
const mobileLabels: Record<string, string> = { "/": "Início", "/chat": "Chat" };
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
	const attention = useChatAttention();
	const routeIndex = mobileRoutes.findIndex((item) => isTabActive(pathname, item.path));
	const activeIndex = menuOpen || routeIndex === -1 ? mobileRoutes.length : routeIndex;

	return (
		<>
			<nav
				aria-label="Navegação principal"
				className="mobile-bottom-nav grid h-16 shrink-0 grid-cols-5 border-t border-border bg-chrome"
			>
				{mobileRoutes.map((item, index) => {
					const Icon = item.icon;
					const active = activeIndex === index;
					const isChat = item.path === "/chat";

					return (
						<Link
							key={item.path}
							to={item.path}
							aria-label={isChat && attention.label ? `Chat: ${attention.label}` : item.label}
							aria-current={isTabActive(pathname, item.path) ? "page" : undefined}
							data-active={active}
							className="mobile-bottom-nav-item"
						>
							<span className="relative inline-flex">
								<Icon
									aria-hidden
									data-waiting={isChat && attention.waiting > 0}
									className="size-5"
								/>
								{isChat && <AgentWaitingBadge count={attention.waiting} layout="compact" />}
							</span>
							<span className="flex items-center gap-1 text-[11px] leading-4">
								{mobileLabels[item.path] ?? item.label}
								{isChat && <AgentWorkingPulse count={attention.working} layout="expanded" />}
							</span>
						</Link>
					);
				})}
				<button
					type="button"
					aria-label="Abrir menu do app"
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
