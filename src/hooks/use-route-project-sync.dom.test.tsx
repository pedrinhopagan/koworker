import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";

import { act, cleanup, render, waitFor } from "../../tests/web/testing-library";
import { useSelectedProjectStore } from "@/stores/selected-project";
import { useRouteProjectSync } from "./use-route-project-sync";

afterEach(async () => {
	await cleanup();
	useSelectedProjectStore.getState().setSelectedProjectId(null);
});

function setupRouter(initialPath: string, waitForProject?: () => Promise<void>) {
	const root = createRootRouteWithContext<{
		queryClient: QueryClient;
		routeProjectId?: string;
	}>()({
		component: () => {
			useRouteProjectSync();
			return <Outlet />;
		},
	});
	const home = createRoute({ getParentRoute: () => root, path: "/", component: () => null });
	const detail = createRoute({
		getParentRoute: () => root,
		path: "/detail/$projectId",
		beforeLoad: async ({ params }) => {
			await waitForProject?.();
			return { routeProjectId: params.projectId };
		},
		component: () => null,
	});

	return createRouter({
		routeTree: root.addChildren([home, detail]),
		context: { queryClient: new QueryClient() },
		history: createMemoryHistory({ initialEntries: [initialPath] }),
	});
}

describe("useRouteProjectSync", () => {
	test.each([null, undefined, "projeto-anterior"])(
		"entrada direta seleciona o projeto da rota com seleção inicial %s",
		async (selectedProjectId) => {
			useSelectedProjectStore.getState().setSelectedProjectId(selectedProjectId);
			const router = setupRouter("/detail/projeto-da-rota");

			await router.load();
			render(<RouterProvider router={router} />);

			await waitFor(() => {
				expect(useSelectedProjectStore.getState().selectedProjectId).toBe("projeto-da-rota");
			});
		},
	);

	test("pré-carga não troca o projeto e a navegação concluída troca", async () => {
		useSelectedProjectStore.getState().setSelectedProjectId("projeto-atual");
		const router = setupRouter("/");

		await router.load();
		render(<RouterProvider router={router} />);
		await act(async () => {
			await router.preloadRoute({ to: "/detail/$projectId", params: { projectId: "outro" } });
		});

		expect(useSelectedProjectStore.getState().selectedProjectId).toBe("projeto-atual");

		await act(async () => {
			await router.navigate({ href: "/detail/outro" });
		});

		expect(router.state.matches.at(-1)?.context.routeProjectId).toBe("outro");
		await waitFor(() => {
			expect(useSelectedProjectStore.getState().selectedProjectId).toBe("outro");
		});
	});

	test("resposta atrasada de uma navegação abandonada não muda a seleção", async () => {
		const projectReady = Promise.withResolvers<void>();
		const projectRequested = Promise.withResolvers<void>();
		const router = setupRouter("/", async () => {
			projectRequested.resolve();
			await projectReady.promise;
		});
		useSelectedProjectStore.getState().setSelectedProjectId("projeto-atual");

		await router.load();
		render(<RouterProvider router={router} />);
		await act(async () => {
			const pending = router.navigate({ href: "/detail/outro" });
			await projectRequested.promise;
			await router.navigate({ to: "/" });
			projectReady.resolve();
			await pending;
		});

		expect(router.state.location.pathname).toBe("/");
		expect(useSelectedProjectStore.getState().selectedProjectId).toBe("projeto-atual");
	});
});
