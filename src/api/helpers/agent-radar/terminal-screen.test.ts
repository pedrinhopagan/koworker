import { expect, test } from "bun:test";

import { decideWheel, recentWindow } from "./terminal-screen";

const lines = Array.from({ length: 100 }, (_, index) => `linha-${index + 1}`);

test("janela termina offset linhas antes do fim", () => {
	const window = recentWindow(lines, 10, 5);
	expect(window.offset).toBe(5);
	const content = window.ansi.split("\n");
	expect(content).toHaveLength(10);
	expect(content[0]).toBe("linha-86");
	expect(content.at(-1)).toBe("linha-95");
});

test("offset zero devolve a cauda inteira", () => {
	const window = recentWindow(lines, 10, 0);
	expect(window.offset).toBe(0);
	expect(window.ansi.split("\n")[0]).toBe("linha-91");
	expect(window.ansi.split("\n").at(-1)).toBe("linha-100");
});

test("offset além do topo clamp e volta ajustado", () => {
	const window = recentWindow(lines, 10, 500);
	expect(window.offset).toBe(90);
	expect(window.ansi.split("\n")[0]).toBe("linha-1");
	expect(window.ansi.split("\n").at(-1)).toBe("linha-10");
});

test("história menor que o grid devolve tudo sem offset", () => {
	const window = recentWindow(["a", "b"], 10, 7);
	expect(window.offset).toBe(0);
	expect(window.ansi).toBe("a\nb");
});

test("wheel no vivo com histórico vira scroll da ponte", () => {
	expect(decideWheel({ offset: 0, maxOffset: 30 }, 3)).toBe("history");
});

test("wheel pra baixo no vivo vai pro agent", () => {
	expect(decideWheel({ offset: 0, maxOffset: 30 }, -3)).toBe("forward");
});

test("wheel pra cima sem histórico vai pro agent", () => {
	expect(decideWheel({ offset: 0, maxOffset: 0 }, 5)).toBe("forward");
});

test("scrollado, qualquer direção continua na ponte", () => {
	expect(decideWheel({ offset: 10, maxOffset: 30 }, 5)).toBe("history");
	expect(decideWheel({ offset: 10, maxOffset: 0 }, -5)).toBe("history");
});
