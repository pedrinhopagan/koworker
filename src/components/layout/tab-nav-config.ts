export type TabPath =
	| "/"
	| "/projetos"
	| "/tarefas"
	| "/mostruario"
	| "/media"
	| "/skills"
	| "/vault"
	| "/terminals"
	| "/chat"
	| "/agents";
export type Tab = { path: TabPath; label: string; altKey?: string };

export const tabs: Tab[] = [
	{ path: "/", label: "Home", altKey: "1" },
	{ path: "/projetos", label: "Projetos", altKey: "2" },
	{ path: "/tarefas", label: "Tarefas", altKey: "3" },
	{ path: "/chat", label: "Chat", altKey: "4" },
	{ path: "/mostruario", label: "Mostruário", altKey: "6" },
	{ path: "/media", label: "Mídia", altKey: "7" },
	{ path: "/skills", label: "Skills", altKey: "8" },
	{ path: "/vault", label: "Vault", altKey: "9" },
	{ path: "/agents", label: "Agents", altKey: "0" },
];

export function isTabActive(currentPath: string, tabPath: string): boolean {
	if (tabPath === "/") {
		return currentPath === "/" || currentPath === "/home";
	}
	return currentPath === tabPath || currentPath.startsWith(`${tabPath}/`);
}
