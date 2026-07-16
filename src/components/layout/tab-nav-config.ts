export type TabPath =
	| "/"
	| "/projetos"
	| "/tarefas"
	| "/mostruario"
	| "/executar"
	| "/media"
	| "/skills"
	| "/vault"
	| "/kw-terminal"
	| "/agents"
	| "/prompts";
export type Tab = { path: TabPath; label: string; altKey?: string };

export const tabs: Tab[] = [
	{ path: "/", label: "Home", altKey: "1" },
	{ path: "/projetos", label: "Projetos", altKey: "2" },
	{ path: "/tarefas", label: "Tarefas", altKey: "3" },
	{ path: "/mostruario", label: "Mostruário", altKey: "4" },
	{ path: "/executar", label: "Execução", altKey: "5" },
	{ path: "/media", label: "Mídia", altKey: "6" },
	{ path: "/skills", label: "Skills", altKey: "7" },
	{ path: "/vault", label: "Vault", altKey: "8" },
	{ path: "/kw-terminal", label: "kw-terminal", altKey: "9" },
	{ path: "/agents", label: "Agents", altKey: "0" },
	{ path: "/prompts", label: "Prompts" },
];

export const topTabs = tabs.slice(0, 3);

export function isTabActive(currentPath: string, tabPath: string): boolean {
	if (tabPath === "/") {
		return currentPath === "/" || currentPath === "/home";
	}
	return currentPath === tabPath || currentPath.startsWith(`${tabPath}/`);
}
