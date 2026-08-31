import { rootOf } from "../../stores/split-view";

type SidebarRouteClick = {
	path: string;
	splitPath: string | null;
	shiftKey: boolean;
};

export function resolveSidebarRouteClick({ path, splitPath, shiftKey }: SidebarRouteClick) {
	if (shiftKey) {
		return "pin" as const;
	}

	if (splitPath && rootOf(splitPath) === path) {
		return "poke" as const;
	}

	return "navigate" as const;
}
