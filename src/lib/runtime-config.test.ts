import { describe, expect, it } from "bun:test";

import {
	DEFAULT_KOWORK_API_ORIGIN,
	KOWORK_PROD_API_ORIGIN,
	resolveApiOrigin,
} from "./runtime-config";

describe("runtime-config", () => {
	it("usa a nova porta padrao 2841 no fallback do app", () => {
		expect(DEFAULT_KOWORK_API_ORIGIN).toBe("http://localhost:2841");
	});

	it("usa a porta desktop 2841 no Electron em desenvolvimento", () => {
		const origin = resolveApiOrigin({
			windowOrigin: "http://localhost:2841",
			isDesktopEnvironment: true,
			appEnv: "development",
		});

		expect(origin).toBe("http://localhost:2841");
	});

	it("usa a porta desktop 2842 no Electron em produção", () => {
		const origin = resolveApiOrigin({
			windowOrigin: "http://localhost:2842",
			isDesktopEnvironment: true,
			appEnv: "production",
		});

		expect(origin).toBe(KOWORK_PROD_API_ORIGIN);
	});

	it("mantem a origem da janela no navegador comum (dev)", () => {
		const origin = resolveApiOrigin({
			windowOrigin: "http://localhost:3001",
			isDesktopEnvironment: false,
		});

		expect(origin).toBe("http://localhost:3001");
	});

	it("usa a mesma origem no navegador web em produção (VPS)", () => {
		const origin = resolveApiOrigin({
			windowOrigin: "https://kw.paganagency.dedyn.io",
			isDesktopEnvironment: false,
			appEnv: "production",
		});

		expect(origin).toBe("https://kw.paganagency.dedyn.io");
	});
});
