import type { LucideIcon } from "lucide-react";
import {
	Archive,
	Bot,
	Brush,
	Columns2,
	EyeOff,
	FilePlus2,
	FolderKanban,
	Home,
	Image,
	Layers,
	ListChecks,
	MessageSquareText,
	OctagonX,
	Presentation,
	RefreshCw,
	Settings,
	Sparkles,
	SquarePen,
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

export type SidebarNavActionId =
	| "openSwitcher"
	| "newVaultNote"
	| "newTask"
	| "refreshPage"
	| "sweepInvocations"
	| "sweepAll"
	| "hideWindow"
	| "toggleSplit";

export type SidebarNavActionItem = {
	kind: "action";
	id: SidebarNavActionId;
	label: string;
	icon: LucideIcon;
	altKey?: string;
	desktopOnly?: boolean;
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
			{ kind: "route", path: "/mostruario", label: "Mostruário", icon: Presentation, altKey: "4" },
			{ kind: "route", path: "/shells", label: "Shells", icon: SquareTerminal, altKey: "5" },
			{ kind: "route", path: "/media", label: "Mídia", icon: Image, altKey: "6" },
		],
	},
	{
		label: "Biblioteca",
		items: [
			{
				kind: "action",
				id: "openSwitcher",
				label: "Sessões de leitura",
				icon: Layers,
				altKey: "`",
			},
			{ kind: "route", path: "/skills", label: "Skills", icon: Sparkles, altKey: "7" },
			{ kind: "route", path: "/vault", label: "Vault", icon: Archive, altKey: "8" },
			{ kind: "route", path: "/agents", label: "Perfis de agents", icon: Bot, altKey: "0" },
			{ kind: "route", path: "/prompts", label: "Prompts", icon: MessageSquareText },
		],
	},
	{
		label: "Ações",
		items: [
			{ kind: "action", id: "newTask", label: "Nova tarefa", icon: SquarePen },
			{ kind: "action", id: "newVaultNote", label: "Nova nota no vault", icon: FilePlus2 },
			{
				kind: "action",
				id: "toggleSplit",
				label: "Dividir tela",
				icon: Columns2,
				desktopOnly: true,
			},
			{
				kind: "action",
				id: "refreshPage",
				label: "Atualizar página",
				icon: RefreshCw,
			},
			{
				kind: "action",
				id: "sweepInvocations",
				label: "Fechar invocações",
				icon: Brush,
			},
			{
				kind: "action",
				id: "sweepAll",
				label: "Limpar tudo ativo",
				icon: OctagonX,
			},
		],
	},
	{
		label: "Sistema",
		items: [
			{ kind: "route", path: "/configuracoes", label: "Configurações", icon: Settings },
			{
				kind: "action",
				id: "hideWindow",
				label: "Esconder janela",
				icon: EyeOff,
				desktopOnly: true,
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
