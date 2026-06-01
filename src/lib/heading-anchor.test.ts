import { describe, expect, it } from "bun:test";

import { anchorAtLine, headingsOf, lineForAnchor, offsetOfLine } from "./heading-anchor";

// Linhas 1-based: H1 "Título" (1), "Seção A" (3), "Seção B" (5), "Seção A" repetida (7).
const DOC = [
	"# Título",
	"intro",
	"## Seção A",
	"corpo a",
	"## Seção B",
	"corpo b",
	"## Seção A",
	"corpo a2",
].join("\n");

describe("headingsOf", () => {
	it("extrai headings com nível e linha", () => {
		expect(headingsOf(DOC)).toEqual([
			{ text: "Título", level: 1, line: 1 },
			{ text: "Seção A", level: 2, line: 3 },
			{ text: "Seção B", level: 2, line: 5 },
			{ text: "Seção A", level: 2, line: 7 },
		]);
	});

	it("ignora headings dentro de fences de código", () => {
		const doc = ["# Real", "```sh", "# isto é comentário", "echo oi", "```", "## Depois"].join(
			"\n",
		);
		expect(headingsOf(doc)).toEqual([
			{ text: "Real", level: 1, line: 1 },
			{ text: "Depois", level: 2, line: 6 },
		]);
	});
});

describe("anchorAtLine", () => {
	it("pega o heading mais próximo acima do topo", () => {
		expect(anchorAtLine(DOC, 4)).toEqual({
			headingText: "Seção A",
			level: 2,
			occurrence: 1,
			headingLine: 3,
		});
	});

	it("conta a ocorrência de headings repetidos", () => {
		expect(anchorAtLine(DOC, 8)).toEqual({
			headingText: "Seção A",
			level: 2,
			occurrence: 2,
			headingLine: 7,
		});
	});

	it("retorna null acima do primeiro heading", () => {
		const doc = ["preâmbulo", "ainda sem heading", "# Primeiro"].join("\n");
		expect(anchorAtLine(doc, 1)).toBeNull();
	});
});

describe("lineForAnchor", () => {
	it("resolve a n-ésima ocorrência exata", () => {
		const line = lineForAnchor(DOC, {
			headingText: "Seção A",
			level: 2,
			occurrence: 2,
			offsetPx: 0,
		});
		expect(line).toBe(7);
	});

	it("acompanha edições que deslocam as linhas", () => {
		const edited = ["nova linha no topo", DOC].join("\n");
		const line = lineForAnchor(edited, {
			headingText: "Seção B",
			level: 2,
			occurrence: 1,
			offsetPx: 0,
		});
		expect(line).toBe(6);
	});

	it("faz fallback pra primeira ocorrência quando a contagem encolheu", () => {
		const shrunk = ["# Título", "## Seção A", "corpo"].join("\n");
		const line = lineForAnchor(shrunk, {
			headingText: "Seção A",
			level: 2,
			occurrence: 2,
			offsetPx: 0,
		});
		expect(line).toBe(2);
	});

	it("retorna null quando o heading sumiu", () => {
		const line = lineForAnchor(DOC, {
			headingText: "Inexistente",
			level: 2,
			occurrence: 1,
			offsetPx: 0,
		});
		expect(line).toBeNull();
	});

	it("retorna null pra âncora antes do primeiro heading", () => {
		expect(
			lineForAnchor(DOC, { headingText: null, level: 0, occurrence: 0, offsetPx: 120 }),
		).toBeNull();
	});
});

describe("offsetOfLine", () => {
	it("calcula o índice de caractere do início da linha", () => {
		expect(offsetOfLine(DOC, 1)).toBe(0);
		expect(offsetOfLine(DOC, 3)).toBe("# Título\nintro\n".length);
	});
});
