import { describe, expect, it } from "bun:test";

import { reflowMarkdown } from "./reflow-markdown";

describe("reflowMarkdown", () => {
	it("junta hard-wraps de prosa num mesmo parágrafo", () => {
		const src = [
			"Correção: trocar o USING puro por um CASE que remapeia durante o",
			"swap do tipo.",
		].join("\n");
		expect(reflowMarkdown(src)).toBe(
			"Correção: trocar o USING puro por um CASE que remapeia durante o swap do tipo.",
		);
	});

	it("mantém parágrafos separados pela linha em branco", () => {
		const src = ["Primeira linha do", "parágrafo um.", "", "Segundo", "parágrafo."].join("\n");
		expect(reflowMarkdown(src)).toBe(
			["Primeira linha do parágrafo um.", "", "Segundo parágrafo."].join("\n"),
		);
	});

	it("não funde a prosa no heading acima", () => {
		const src = ["## Seção", "texto que continua", "na linha de baixo"].join("\n");
		expect(reflowMarkdown(src)).toBe(
			["## Seção", "texto que continua na linha de baixo"].join("\n"),
		);
	});

	it("preserva cada item de lista numa linha", () => {
		const src = ["- [ ] item um", "- [x] item dois", "- item três"].join("\n");
		expect(reflowMarkdown(src)).toBe(src);
	});

	it("preserva o conteúdo do bloco de código", () => {
		const src = [
			"antes do",
			"bloco",
			"",
			"```ts",
			"const a =",
			"  1;",
			"```",
			"depois",
			"do bloco",
		].join("\n");
		expect(reflowMarkdown(src)).toBe(
			["antes do bloco", "", "```ts", "const a =", "  1;", "```", "depois do bloco"].join("\n"),
		);
	});

	it("não fecha a fence com caractere diferente", () => {
		const src = ["```", "~~~", "ainda dentro", "```", "fora"].join("\n");
		expect(reflowMarkdown(src)).toBe(src);
	});

	it("preserva linhas de tabela", () => {
		const src = ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n");
		expect(reflowMarkdown(src)).toBe(src);
	});

	it("preserva citações", () => {
		const src = ["> linha um", "> linha dois"].join("\n");
		expect(reflowMarkdown(src)).toBe(src);
	});

	it("respeita a quebra explícita de dois espaços", () => {
		const src = ["linha com quebra  ", "próxima linha"].join("\n");
		expect(reflowMarkdown(src)).toBe(src);
	});

	it("mantém o frontmatter intacto", () => {
		const src = ["---", "title: foo", "tags:", "  - a", "---", "corpo que", "continua"].join("\n");
		expect(reflowMarkdown(src)).toBe(
			["---", "title: foo", "tags:", "  - a", "---", "corpo que continua"].join("\n"),
		);
	});

	it("preserva o sublinhado de setext", () => {
		const src = ["Título setext", "===", "corpo"].join("\n");
		expect(reflowMarkdown(src)).toBe(["Título setext", "===", "corpo"].join("\n"));
	});

	it("preserva a newline final do arquivo", () => {
		expect(reflowMarkdown("uma\nlinha\n")).toBe("uma linha\n");
	});

	it("é idempotente", () => {
		const src = ["## H", "a", "b", "", "- item", "  cont", "", "```", "x", "y", "```"].join("\n");
		const once = reflowMarkdown(src);
		expect(reflowMarkdown(once)).toBe(once);
	});
});
