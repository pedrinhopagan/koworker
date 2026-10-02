import { describe, expect, test } from "bun:test";

import { resolveSidebarRouteClick } from "./sidebar-route-click";

describe("resolveSidebarRouteClick", () => {
	test("navega normalmente no drawer mobile", () => {
		expect(
			resolveSidebarRouteClick({ path: "/configuracoes", splitPath: null, shiftKey: false }),
		).toBe("navigate");
	});

	test("fixa a rota com shift", () => {
		expect(
			resolveSidebarRouteClick({ path: "/configuracoes", splitPath: null, shiftKey: true }),
		).toBe("pin");
	});

	test("pulsa a rota que já está fixada", () => {
		expect(
			resolveSidebarRouteClick({
				path: "/configuracoes",
				splitPath: "/configuracoes?painel=1",
				shiftKey: false,
			}),
		).toBe("poke");
	});
});
