import { describe, expect, test } from "bun:test";

import { buildProductionIndexHtml } from "./inject-prod-index";
import { buildProductionServiceWorker } from "./inject-prod-sw";

const sourceIndex = `<link rel="stylesheet" href="./index.css" /><script>window.__KOWORK_ENV__ = "development";</script><script type="module" src="./main.tsx"></script>`;

describe("buildProductionIndexHtml", () => {
	test("publica assets absolutos para recarregar qualquer deep link", () => {
		const built = buildProductionIndexHtml(sourceIndex, "1.2.3");

		expect(built).toContain('href="/index.css"');
		expect(built).toContain('src="/main.js"');
		expect(built).toContain('window.__KOWORK_ENV__ = "production"');
		expect(built).toContain('window.__KOWORK_APP_VERSION__ = "1.2.3"');
	});

	test("aborta quando o link do css nao bate", () => {
		const source = sourceIndex.replace('href="./index.css"', 'href="./estilos.css"');

		expect(() => buildProductionIndexHtml(source, "1.2.3")).toThrow(/index.css/);
	});

	test("aborta quando o script principal nao bate", () => {
		const source = sourceIndex.replace('src="./main.tsx"', 'src="./app.tsx"');

		expect(() => buildProductionIndexHtml(source, "1.2.3")).toThrow(/main.js/);
	});

	test("aborta quando o bloco de ambiente nao bate", () => {
		const source = sourceIndex.replace(
			'<script>window.__KOWORK_ENV__ = "development";</script>',
			"",
		);

		expect(() => buildProductionIndexHtml(source, "1.2.3")).toThrow(/__KOWORK_ENV__/);
	});
});

describe("buildProductionServiceWorker", () => {
	test("substitui todas as ocorrencias do placeholder de cache", () => {
		const built = buildProductionServiceWorker(
			`const A = "__KOWORK_SW_CACHE_VERSION__";\nconst B = "__KOWORK_SW_CACHE_VERSION__";`,
			"1.2.3-abc",
		);

		expect(built).not.toContain("__KOWORK_SW_CACHE_VERSION__");
		expect(built.match(/1\.2\.3-abc/g)).toHaveLength(2);
	});

	test("aborta quando o placeholder de cache nao existe", () => {
		expect(() => buildProductionServiceWorker(`const A = "estatico";`, "1.2.3")).toThrow(
			/__KOWORK_SW_CACHE_VERSION__/,
		);
	});
});
