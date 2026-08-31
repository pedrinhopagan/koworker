import { describe, expect, test } from "bun:test";

import { assertSingleTenantRuntime } from "./terminal-access";

describe("assertSingleTenantRuntime", () => {
	test("aceita banco vazio ou com uma conta", () => {
		expect(() => assertSingleTenantRuntime([])).not.toThrow();
		expect(() => assertSingleTenantRuntime([1])).not.toThrow();
	});

	test("nega inicialização com mais de uma conta", () => {
		expect(() => assertSingleTenantRuntime([1, 2])).toThrow("exige uma única conta");
	});
});
