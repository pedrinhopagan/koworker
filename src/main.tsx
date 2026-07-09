import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { Toaster } from "./components/ui/sonner.tsx";
import { registerServiceWorker } from "./lib/register-sw.ts";
import { routeTree } from "./routeTree.gen.ts";

// staleTime alto porque o app é um toggle quake-style: cada exibição da janela dispara um "window
// focus" e, com staleTime 0, TODAS as queries montadas refazem fetch de uma vez — a rajada que
// travava a abertura. A atualização em tempo real não depende disso: o canal WS de tasks/vault
// invalida na hora, e as mutations invalidam o que tocam.
export const queryClient = new QueryClient({
	defaultOptions: { queries: { staleTime: 60_000 } },
});

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
			<Toaster />
		</QueryClientProvider>,
	);
}
