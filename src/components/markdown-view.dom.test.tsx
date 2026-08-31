import { afterEach, describe, expect, test } from "bun:test";

import { MarkdownView } from "@/components/markdown-view";
import { cleanup, render } from "../../tests/web/testing-library";

afterEach(cleanup);

function view(text: string) {
	const { container } = render(<MarkdownView text={text} />);
	return container.querySelector("[data-component='markdown-view']") as HTMLElement;
}

describe("MarkdownView", () => {
	test("headings viram h1..h6 com a classe visual do leitor de .md", () => {
		const root = view("# Título\n\n### Sub");

		expect(root.querySelector("h1")?.textContent).toBe("Título");
		expect(root.querySelector("h1")?.className).toContain("cm-md-h1");
		expect(root.querySelector("h3")?.textContent).toBe("Sub");
		expect(root.querySelector("h3")?.className).toContain("cm-md-h3");
	});

	test("ênfase, grifa e código inline saem sem os marcadores", () => {
		const root = view("Um **forte**, um _fraco_, um ~~riscado~~, um ==grifado== e `codigo()`.");

		expect(root.querySelector("strong")?.textContent).toBe("forte");
		expect(root.querySelector("em")?.textContent).toBe("fraco");
		expect(root.querySelector("del")?.textContent).toBe("riscado");
		expect(root.querySelector("mark")?.textContent).toBe("grifado");
		expect(root.querySelector("code.cm-md-inline-code")?.textContent).toBe("codigo()");
		expect(root.textContent).not.toContain("**");
		expect(root.textContent).not.toContain("~~");
	});

	test("régua vira hr e lista vira ul com item por linha", () => {
		const root = view("- um\n- dois\n\n---\n\n1. primeiro");

		expect(root.querySelectorAll("ul li")).toHaveLength(2);
		expect(root.querySelector("hr")?.className).toContain("cm-md-divider");
		expect(root.querySelector("ol li")?.textContent).toBe("primeiro");
	});

	test("item de tarefa ganha checkbox e perde o marcador cru", () => {
		const root = view("- [x] feito\n- [ ] pendente");

		expect(root.querySelectorAll("li.md-view-task")).toHaveLength(2);
		expect(root.querySelectorAll("[data-slot='checkbox']")).toHaveLength(2);
		expect(root.textContent).not.toContain("[x]");
	});

	test("fence vira bloco de código preservando o conteúdo cru", () => {
		const root = view("Antes\n\n```ts\nconst a = 1;\n```\n\nDepois");
		const pre = root.querySelector("pre.cm-md-code-block");

		expect(pre?.textContent).toBe("const a = 1;");
		expect(pre?.className).toContain("cm-md-code-block-last");
		expect(root.textContent).not.toContain("```");
	});

	test("citação e tabela viram os elementos correspondentes", () => {
		const root = view("> citado\n\n| a | b |\n| --- | --- |\n| 1 | 2 |");

		expect(root.querySelector("blockquote.cm-md-blockquote")?.textContent).toContain("citado");
		expect(root.querySelectorAll("table.cm-md-table th")).toHaveLength(2);
		expect(root.querySelectorAll("table.cm-md-table td")).toHaveLength(2);
	});

	test("link http vira âncora e esquema perigoso vira texto", () => {
		const root = view("[ok](https://kowork.dev) e [não](javascript:alert(1))");
		const links = root.querySelectorAll("a");

		expect(links).toHaveLength(1);
		expect(links[0]?.getAttribute("href")).toBe("https://kowork.dev");
		expect(root.textContent).toContain("não");
	});

	test("caminho absoluto vira file URI em vez de rota do servidor", () => {
		const root = view("[revisão](/mnt/projeto/.koworker/tarefa/review.md)");

		expect(root.querySelector("a")?.getAttribute("href")).toBe(
			"file:///mnt/projeto/.koworker/tarefa/review.md",
		);
	});
});
