import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { queryClient } from "@/lib/query-client";
import { routeTree } from "@/routeTree.gen";
import { useSplitViewStore } from "@/stores/split-view";

function createPinnedRouter(initialPath: string) {
	const router = createRouter({
		routeTree,
		context: { queryClient, nested: true },
		history: createMemoryHistory({ initialEntries: [initialPath] }),
		defaultPreload: false,
		defaultStructuralSharing: true,
		defaultPreloadStaleTime: 0,
	});

	void router.load();

	return router;
}

let pinnedRouter: ReturnType<typeof createPinnedRouter> | null = null;

function getPinnedRouter(path: string) {
	pinnedRouter ??= createPinnedRouter(path);
	return pinnedRouter;
}

export function PinnedPane() {
	const left = useSplitViewStore((state) => state.left);
	const lastPushed = useRef<string | null>(null);

	const router = useRef<ReturnType<typeof createPinnedRouter> | null>(null);
	router.current ??= getPinnedRouter(left ?? "/shells");

	useEffect(() => {
		const current = router.current;
		if (!current || !left) {
			return;
		}

		if (lastPushed.current === left) {
			return;
		}

		lastPushed.current = left;

		if (current.state.location.href !== left) {
			void current.navigate({ href: left });
		}
	}, [left]);

	useEffect(() => {
		lastPushed.current = useSplitViewStore.getState().left;
	}, []);

	return <RouterProvider router={router.current} />;
}
