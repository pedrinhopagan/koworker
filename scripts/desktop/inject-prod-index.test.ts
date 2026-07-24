import { describe, expect, test } from "bun:test";

import { buildProductionIndexHtml } from "./inject-prod-index";

describe("buildProductionIndexHtml", () => {
	test("publica assets absolutos para recarregar qualquer deep link", () => {
		const source = `<link rel="stylesheet" href="./index.css" /><script>window.__KOWORK_ENV__ = "development";</script><script type="module" src="./main.tsx"></script>`;
		const built = buildProductionIndexHtml(source, "1.2.3");

		expect(built).toContain('href="/index.css"');
		expect(built).toContain('src="/main.js"');
		expect(built).toContain('window.__KOWORK_ENV__ = "production"');
		expect(built).toContain('window.__KOWORK_APP_VERSION__ = "1.2.3"');
	});
});
