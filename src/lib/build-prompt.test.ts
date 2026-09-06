import { describe, expect, test } from "bun:test";

import { convertSkillCallsForCli } from "@/lib/build-prompt";

describe("convertSkillCallsForCli", () => {
	const prompt = "/kw tarefas/feature.md\n\nUse /plan e preserve /mnt/data";

	test("mantém a sintaxe do Claude", () => {
		expect(convertSkillCallsForCli(prompt, "claude")).toBe(prompt);
	});

	test("usa custom prompts no Codex", () => {
		expect(convertSkillCallsForCli(prompt, "codex")).toBe(
			"$kw tarefas/feature.md\n\nUse $plan e preserve /mnt/data",
		);
	});

	test("usa /skill:slug no Pi", () => {
		expect(convertSkillCallsForCli(prompt, "pi")).toBe(
			"/skill:kw tarefas/feature.md\n\nUse /skill:plan e preserve /mnt/data",
		);
	});
});
