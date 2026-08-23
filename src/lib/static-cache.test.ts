import { describe, expect, test } from "bun:test";

import { isHashedChunk, staticCacheHeader } from "./static-cache";

describe("staticCacheHeader", () => {
	test("shell e assets sem hash revalidam sempre", () => {
		expect(staticCacheHeader("/")).toBe("no-cache");
		expect(staticCacheHeader("/index.html")).toBe("no-cache");
		expect(staticCacheHeader("/sw.js")).toBe("no-cache");
		expect(staticCacheHeader("/main.js")).toBe("no-cache");
		expect(staticCacheHeader("/index.css")).toBe("no-cache");
	});

	test("chunks com hash viram imutáveis", () => {
		expect(isHashedChunk("/apl-pdsqtjeg.js")).toBe(true);
		expect(isHashedChunk("/dispositivos.lazy-pw2yg2ah.js")).toBe(true);
		expect(staticCacheHeader("/apl-pdsqtjeg.js")).toBe("public, max-age=31536000, immutable");
	});

	test("arquivos sem hash não passam por imutáveis", () => {
		expect(isHashedChunk("/main.js")).toBe(false);
		expect(isHashedChunk("/index.css")).toBe(false);
		expect(isHashedChunk("/arquivo-simples.js")).toBe(false);
		expect(isHashedChunk("/fonte-arquivo.css")).toBe(false);
	});

	test("estáticos estáveis têm cache longo e o manifest revalida", () => {
		expect(staticCacheHeader("/static/fonts/fonts.css")).toContain("max-age=604800");
		expect(staticCacheHeader("/static/icons/pwa-192.png")).toContain("max-age=604800");
		expect(staticCacheHeader("/static/manifest.webmanifest")).toBe("no-cache");
	});

	test("json de versão e rotas desconhecidas nunca ficam presas em cache", () => {
		expect(staticCacheHeader("/version.json")).toBe("no-cache");
		expect(staticCacheHeader("/revision.json")).toBe("no-cache");
		expect(staticCacheHeader("/qualquer-coisa")).toBe("no-cache");
	});
});
