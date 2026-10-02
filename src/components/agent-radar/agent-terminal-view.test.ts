import { expect, test } from "bun:test";

import { buildScreenPatch } from "./agent-terminal-view";

const ESC = "";

test("repinta só as linhas que mudaram", () => {
	expect(buildScreenPatch(["a", "b", "c"], ["a", "B", "c"], 3)).toBe(
		`${ESC}[2;1H${ESC}[0m${ESC}[2KB${ESC}[0m`,
	);
});

test("tela idêntica não gera escrita", () => {
	expect(buildScreenPatch(["a", "b"], ["a", "b"], 2)).toBe("");
});

test("linha que sumiu é apagada e o patch para no fim do grid", () => {
	expect(buildScreenPatch(["a", "b"], ["a"], 2)).toBe(`${ESC}[2;1H${ESC}[0m${ESC}[2K${ESC}[0m`);
	expect(buildScreenPatch([], ["a", "b", "c"], 2)).not.toContain(`${ESC}[3;1H`);
});

test("uma linha alterada escreve uma fração do frame completo", () => {
	const previous = Array.from(
		{ length: 24 },
		(_, row) => `${String(row).padStart(2, "0")}:${"x".repeat(77)}`,
	);
	const lines = [...previous];
	lines[12] = `12:${"y".repeat(77)}`;
	const fullFrameBytes = Buffer.byteLength(lines.join("\n"));
	const patchBytes = Buffer.byteLength(buildScreenPatch(previous, lines, 24));

	expect(fullFrameBytes).toBe(1_943);
	expect(patchBytes).toBe(99);
	expect(patchBytes).toBeLessThan(fullFrameBytes / 10);
});
