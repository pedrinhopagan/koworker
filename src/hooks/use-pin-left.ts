import { useLocation, useNavigate } from "@tanstack/react-router";

import { isShellsPath, rootOf, useSplitViewStore } from "@/stores/split-view";

// Fixa uma rota da sidebar no painel da esquerda do split view. É o shift+clique na navegação:
// entra (ou troca) o modo de tela dividida sem passar pelo dialog. Se a rota fixada é a mesma
// que já está na área principal, ela recua para a Home para não duplicar.
export function usePinLeft() {
	const navigate = useNavigate();
	const location = useLocation();
	const openSplit = useSplitViewStore((state) => state.open);

	return function pinLeft(path: string) {
		const leftRoot = rootOf(path);
		const leftHref =
			leftRoot === "/shells" && isShellsPath(location.pathname)
				? `/shells${location.searchStr}`
				: path;

		openSplit(leftHref);

		if (leftRoot === rootOf(location.pathname)) {
			void navigate({ href: "/", replace: true });
		}
	};
}
