import { useRouterState } from "@tanstack/react-router";
import { useLayoutEffect } from "react";

import { useSelectedProjectStore } from "@/stores/selected-project";

export function useRouteProjectSync() {
	const routeProjectId = useRouterState({
		select: (state) => state.matches.at(-1)?.context.routeProjectId,
	});
	const setSelectedProjectId = useSelectedProjectStore((state) => state.setSelectedProjectId);

	useLayoutEffect(() => {
		if (routeProjectId) {
			setSelectedProjectId(routeProjectId);
		}
	}, [routeProjectId, setSelectedProjectId]);
}
