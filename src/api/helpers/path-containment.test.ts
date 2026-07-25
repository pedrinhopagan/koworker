import { describe, expect, test } from "bun:test";
import { sep } from "node:path";

import { isPathInside } from "./path-containment";

const root = `${sep}projeto${sep}.koworker`;

describe("isPathInside", () => {
	test("aceita a própria raiz e os descendentes", () => {
		for (const target of [
			root,
			`${root}${sep}tasks`,
			`${root}${sep}tasks${sep}feature--a1b2c3d4${sep}index.md`,
		]) {
			expect(isPathInside(root, target)).toBe(true);
		}
	});

	test("recusa irmão com o mesmo prefixo textual", () => {
		for (const target of [
			`${root}-outro`,
			`${root}-outro${sep}tasks`,
			`${sep}projeto${sep}.koworkerx`,
			`${sep}projeto`,
			`${sep}outro${sep}.koworker${sep}tasks`,
		]) {
			expect(isPathInside(root, target)).toBe(false);
		}
	});

	test("raiz vazia não contém nada", () => {
		expect(isPathInside("", `${sep}projeto`)).toBe(false);
		expect(isPathInside("", "")).toBe(false);
		expect(isPathInside(root, "")).toBe(false);
	});

	test("raiz com separador final não desloca o limite", () => {
		expect(isPathInside(`${root}${sep}`, `${root}${sep}tasks`)).toBe(true);
		expect(isPathInside(`${root}${sep}`, root)).toBe(true);
		expect(isPathInside(`${root}${sep}`, `${root}-outro`)).toBe(false);
	});

	test("raiz do filesystem contém qualquer caminho absoluto", () => {
		expect(isPathInside(sep, `${sep}projeto`)).toBe(true);
		expect(isPathInside(sep, sep)).toBe(true);
	});
});
