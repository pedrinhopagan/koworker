import { describe, expect, it } from "bun:test";

import { DEFAULT_KOWORK_API_ORIGIN, resolveApiOrigin } from "./runtime-config";

describe("runtime-config", () => {
	it("usa a nova porta padrao 4178 no fallback do app", () => {
		expect(DEFAULT_KOWORK_API_ORIGIN).toBe("http://localhost:4178");
	});

	it("prioriza url injetada na window quando existir", () => {
		const origin = resolveApiOrigin({
			windowApiUrl: "http://localhost:9999",
			windowOrigin: "http://localhost:4178",
			isTauriEnvironment: true,
		});

		expect(origin).toBe("http://localhost:9999");
	});

	it("usa a porta desktop 4178 quando estiver no Tauri sem override", () => {
		const origin = resolveApiOrigin({
			windowApiUrl: undefined,
			windowOrigin: "tauri://localhost",
			isTauriEnvironment: true,
		});

		expect(origin).toBe("http://localhost:4178");
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
