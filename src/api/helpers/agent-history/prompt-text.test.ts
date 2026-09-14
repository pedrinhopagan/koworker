import { describe, expect, test } from "bun:test";

import { extractUserPrompt, normalizePrompt } from "./prompt-text";

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

describe("extractUserPrompt", () => {
	test("descarta o que o usuário não digitou como prompt", () => {
		expect(extractUserPrompt("/clear")).toBeNull();
		expect(extractUserPrompt("[Request interrupted by user for tool use]")).toBeNull();
		expect(extractUserPrompt("Imagem enviada")).toBeNull();
		expect(extractUserPrompt("[Image #1]")).toBeNull();
		expect(
			extractUserPrompt("Esta conversa continua uma sessão anterior conduzida no Claude"),
		).toBeNull();
		expect(
			extractUserPrompt(
				"<task-notification>\n<task-id>a41</task-id>\n<output-file>/tmp/x</output-file>",
			),
		).toBeNull();
		expect(extractUserPrompt("<local-command-stdout>Compacted</local-command-stdout>")).toBeNull();
	});

	test("mantém o prompt e traduz comando local", () => {
		expect(extractUserPrompt("/kw docs/a.md o que acha?")).toBe("/kw docs/a.md o que acha?");
		expect(extractUserPrompt("continue")).toBe("continue");
		expect(extractUserPrompt("[Image #1] o que está sendo reportado?")).toBe(
			"[Image #1] o que está sendo reportado?",
		);
		expect(extractUserPrompt("/bro me explica")).toBe("/bro me explica");
		expect(
			extractUserPrompt(
				"<command-message>bro</command-message>\n<command-name>/bro</command-name>",
			),
		).toBeNull();
	});
});
