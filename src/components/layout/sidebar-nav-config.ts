import type { LucideIcon } from "lucide-react";
import {
	Archive,
	Bot,
	FolderKanban,
	Gauge,
	Home,
	Image,
	ListChecks,
	Presentation,
	Settings,
	Sparkles,
	SquareTerminal,
} from "lucide-react";

import { isTabActive } from "@/components/layout/tab-nav-config";

export type SidebarNavRouteItem = {
	kind: "route";
	path: string;
	label: string;
	icon: LucideIcon;
	altKey?: string;
};

export type SidebarNavSelectProjectItem = {
	kind: "selectProject";
	label: string;
	icon: LucideIcon;
	altKey: "P";
};

export type SidebarNavItem = SidebarNavRouteItem | SidebarNavSelectProjectItem;

export type SidebarNavGroup = {
	label: string;
	items: SidebarNavItem[];
};

export const sidebarSelectProjectItem: SidebarNavSelectProjectItem = {
	kind: "selectProject",
	label: "Selecionar projeto",
	icon: FolderKanban,
	altKey: "P",
};

export const sidebarNavGroups: SidebarNavGroup[] = [
	{
		label: "Trabalho",
		items: [
			{ kind: "route", path: "/", label: "Home", icon: Home, altKey: "1" },
			{ kind: "route", path: "/projetos", label: "Projetos", icon: FolderKanban, altKey: "2" },
			{ kind: "route", path: "/tarefas", label: "Tarefas", icon: ListChecks, altKey: "3" },
			{ kind: "route", path: "/shells", label: "Shells", icon: SquareTerminal, altKey: "4" },
			{ kind: "route", path: "/painel", label: "Painel", icon: Gauge, altKey: "5" },
			{ kind: "route", path: "/mostruario", label: "Mostruário", icon: Presentation, altKey: "6" },
			{ kind: "route", path: "/media", label: "Mídia", icon: Image, altKey: "7" },
		],
	},
	{
		label: "Biblioteca",
		items: [
			{ kind: "route", path: "/skills", label: "Skills", icon: Sparkles, altKey: "8" },
			{ kind: "route", path: "/vault", label: "Vault", icon: Archive, altKey: "9" },
			{ kind: "route", path: "/agents", label: "Perfis de agents", icon: Bot, altKey: "0" },
		],
	},
	{
		label: "Sistema",
		items: [{ kind: "route", path: "/configuracoes", label: "Configurações", icon: Settings }],
	},
];

export function isSidebarRouteActive(currentPath: string, path: string): boolean {
	return isTabActive(currentPath, path);
}

export function formatSidebarShortcut(altKey?: string): string | undefined {
	if (!altKey) {
		return undefined;
	}
	return `Alt+${altKey}`;
}
