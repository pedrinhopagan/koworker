import type { LucideIcon } from "lucide-react";
import {
	Archive,
	Bot,
	Brush,
	CalendarDays,
	FilePlus2,
	FolderKanban,
	Home,
	Layers,
	ListChecks,
	MessageSquareText,
	RefreshCw,
	Settings,
	Sparkles,
	SquarePen,
	X,
} from "lucide-react";

import { isTabActive } from "@/components/layout/tab-nav-config";

export type SidebarNavRouteItem = {
	kind: "route";
	path: string;
	label: string;
	icon: LucideIcon;
	altKey: string;
};

export type SidebarNavActionId =
	| "openSwitcher"
	| "newVaultNote"
	| "newTask"
	| "refreshPage"
	| "sweepInvocations"
	| "hideWindow";

export type SidebarNavActionItem = {
	kind: "action";
	id: SidebarNavActionId;
	label: string;
	icon: LucideIcon;
	altKey?: string;
	tauriOnly?: boolean;
};

export type SidebarNavSelectProjectItem = {
	kind: "selectProject";
	label: string;
	icon: LucideIcon;
	altKey: "P";
};

export type SidebarNavItem =
	| SidebarNavRouteItem
	| SidebarNavActionItem
	| SidebarNavSelectProjectItem;

export type SidebarNavGroup = {
	items: SidebarNavItem[];
};

/**
 * Rotas principais exibidas apenas na variante drawer/mobile — no desktop elas ficam na TabBar.
 */
export const sidebarSelectProjectItem: SidebarNavSelectProjectItem = {
	kind: "selectProject",
	label: "Selecionar projeto",
	icon: FolderKanban,
	altKey: "P",
};

export const drawerTopRoutes: SidebarNavRouteItem[] = [
	{ kind: "route", path: "/", label: "Home", icon: Home, altKey: "1" },
	{ kind: "route", path: "/projetos", label: "Projetos", icon: FolderKanban, altKey: "2" },
	{ kind: "route", path: "/tarefas", label: "Tarefas", icon: ListChecks, altKey: "3" },
];

export const sidebarNavGroups: SidebarNavGroup[] = [
	{
		items: [
			{ kind: "route", path: "/vault", label: "Vault", icon: Archive, altKey: "4" },
			{ kind: "route", path: "/skills", label: "Skills", icon: Sparkles, altKey: "6" },
			{ kind: "route", path: "/agents", label: "Agents", icon: Bot, altKey: "7" },
			{ kind: "route", path: "/agenda", label: "Agenda", icon: CalendarDays, altKey: "5" },
		],
	},
	{
		items: [
			{
				kind: "action",
				id: "openSwitcher",
				label: "Sessões de leitura",
				icon: Layers,
				altKey: "`",
			},
		],
	},
	{
		items: [
			{ kind: "action", id: "newVaultNote", label: "Nova nota no vault", icon: FilePlus2 },
			{ kind: "action", id: "newTask", label: "Nova tarefa", icon: SquarePen },
			{
				kind: "action",
				id: "refreshPage",
				label: "Atualizar dados da página",
				icon: RefreshCw,
			},
			{
				kind: "action",
				id: "sweepInvocations",
				label: "Fechar terminais de invocação",
				icon: Brush,
			},
			{
				kind: "action",
				id: "hideWindow",
				label: "Esconder janela",
				icon: X,
				tauriOnly: true,
			},
		],
	},
	{
		items: [
			{
				kind: "route",
				path: "/configuracoes",
				label: "Configurações",
				icon: Settings,
				altKey: "0",
			},
			{
				kind: "route",
				path: "/prompts",
				label: "Prompts",
				icon: MessageSquareText,
				altKey: "8",
			},
		],
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
