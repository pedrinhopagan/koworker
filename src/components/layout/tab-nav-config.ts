export type TabPath = "/" | "/projetos" | "/tarefas" | "/vault" | "/agenda" | "/skills" | "/agents";
export type Tab = { path: TabPath; label: string; altKey: string };

export const tabs: Tab[] = [
	{ path: "/", label: "Home", altKey: "1" },
	{ path: "/projetos", label: "Projetos", altKey: "2" },
	{ path: "/tarefas", label: "Tarefas", altKey: "3" },
	{ path: "/vault", label: "Vault", altKey: "4" },
	{ path: "/agenda", label: "Agenda", altKey: "5" },
	{ path: "/skills", label: "Skills", altKey: "6" },
	{ path: "/agents", label: "Agents", altKey: "7" },
];

export function isTabActive(currentPath: string, tabPath: string): boolean {
	if (tabPath === "/") {
		return currentPath === "/" || currentPath === "/home";
	}
	return currentPath === tabPath || currentPath.startsWith(`${tabPath}/`);
}
