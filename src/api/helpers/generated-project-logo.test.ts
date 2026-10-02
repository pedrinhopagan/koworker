import { describe, expect, test } from "bun:test";

import { createGeneratedProjectLogo } from "./generated-project-logo";

describe("createGeneratedProjectLogo", () => {
	test("cria uma marca determinística com as iniciais do projeto", () => {
		const logo = createGeneratedProjectLogo("Web Template");

		expect(logo).toBe(createGeneratedProjectLogo("Web Template"));
		expect(logo).toContain(">WT</text>");
		expect(logo).toContain('fill="#1D1D1B"');
		expect(logo).not.toContain("rx=");
		expect(logo).not.toContain("linearGradient");
	});

	test("escapa nomes antes de inseri-los no SVG", () => {
		expect(createGeneratedProjectLogo("<script> Test")).not.toContain("><T</text>");
		expect(createGeneratedProjectLogo("<script> Test")).toContain("&lt;T</text>");
	});
});
