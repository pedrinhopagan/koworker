import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { registerServiceWorker } from "./lib/register-sw.ts";
import { routeTree } from "./routeTree.gen.ts";

export { queryClient } from "./lib/query-client.ts";

import { queryClient } from "./lib/query-client.ts";

const router = createRouter({
	routeTree,
	context: { queryClient },
	defaultPreload: false,
	scrollRestoration: true,
	defaultStructuralSharing: true,
	defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

registerServiceWorker();

const rootElement = document.querySelector("#app");

if (rootElement && !rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}
