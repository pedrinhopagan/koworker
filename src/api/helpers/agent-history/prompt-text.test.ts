import { describe, expect, test } from "bun:test";

import { normalizePrompt } from "./prompt-text";

describe("normalizePrompt", () => {
	test("junta a grafia das skills e o espaço em uma chave só", () => {
		const claude = "/kw .koworker/tasks/a--1/b--2/analise.md\n\nMe diga o que acha /commit";
		const codex = "$kw .koworker/tasks/a--1/b--2/analise.md  Me diga o que acha $commit";
		const codexLink =
			"[$kw](/home/x/.codex/skills/kw/SKILL.md) .koworker/tasks/a--1/b--2/analise.md Me diga o que acha $commit";
		const pi = "/skill:kw .koworker/tasks/a--1/b--2/analise.md Me diga o que acha /skill:commit";

		expect(normalizePrompt(codex)).toBe(normalizePrompt(claude));
		expect(normalizePrompt(codexLink)).toBe(normalizePrompt(claude));
		expect(normalizePrompt(pi)).toBe(normalizePrompt(claude));
	});

	test("não mexe em caminho", () => {
		expect(normalizePrompt("veja /mnt/data e a var $HOME e $abc-1")).toBe(
			"veja /mnt/data e a var $HOME e /abc-1",
		);
	});
});
