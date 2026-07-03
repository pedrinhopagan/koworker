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

	it("prioriza url injetada na window quando existir", () => {
		const origin = resolveApiOrigin({
			windowApiUrl: "http://localhost:9999",
			windowOrigin: "http://localhost:2841",
			isTauriEnvironment: true,
		});

		expect(origin).toBe("http://localhost:9999");
	});

	it("usa a porta desktop 2841 quando estiver no Tauri sem override (dev)", () => {
		const origin = resolveApiOrigin({
			windowApiUrl: undefined,
			windowOrigin: "tauri://localhost",
			isTauriEnvironment: true,
			appEnv: "development",
		});

		expect(origin).toBe("http://localhost:2841");
	});

	it("usa a porta desktop 2842 quando estiver no Tauri em produção", () => {
		const origin = resolveApiOrigin({
			windowApiUrl: undefined,
			windowOrigin: "tauri://localhost",
			isTauriEnvironment: true,
			appEnv: "production",
		});

		expect(origin).toBe(KOWORK_PROD_API_ORIGIN);
	});

	it("trata __KOWORK_API_URL__ vazia como ausente no Tauri prod", () => {
		const origin = resolveApiOrigin({
			windowApiUrl: "",
			windowOrigin: "tauri://localhost",
			isTauriEnvironment: true,
			appEnv: "production",
		});

		expect(origin).toBe(KOWORK_PROD_API_ORIGIN);
	});

	it("mantem a origem da janela no navegador comum", () => {
		const origin = resolveApiOrigin({
			windowApiUrl: undefined,
			windowOrigin: "http://localhost:3001",
			isTauriEnvironment: false,
		});

		expect(origin).toBe("http://localhost:3001");
	});
});
