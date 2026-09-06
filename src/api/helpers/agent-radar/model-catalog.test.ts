import { expect, test } from "bun:test";

import { codexModelsFromCache } from "./model-catalog";

test("catálogo do codex sai do cache na ordem do CLI, sem modelos ocultos", () => {
	const models = codexModelsFromCache({
		models: [
			{
				slug: "gpt-5.6-sol",
				display_name: "GPT-5.6-Sol",
				description: "Reliable agentic workhorse.",
				visibility: "list",
				priority: 6,
				default_reasoning_level: "low",
				supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }, { effort: "ultra" }],
			},
			{ slug: "codex-auto-review", visibility: "hide", priority: 43 },
			{
				slug: "gpt-6-astra",
				display_name: "GPT-6-Astra",
				visibility: "list",
				priority: 1,
				supported_reasoning_levels: [{ effort: "medium" }],
			},
		],
	});

	expect(models).toEqual([
		{
			id: "gpt-6-astra",
			label: "GPT 6 Astra",
			hint: "",
			efforts: ["medium"],
			defaultEffort: null,
		},
		{
			id: "gpt-5.6-sol",
			label: "GPT 5.6 Sol",
			hint: "Reliable agentic workhorse.",
			efforts: ["low", "high", "ultra"],
			defaultEffort: "low",
		},
	]);
});

test("cache ilegível ou vazio devolve nulo para cair no catálogo fixo", () => {
	expect(codexModelsFromCache({ models: [] })).toBeNull();
	expect(codexModelsFromCache({ models: [{ slug: "x", visibility: "hide" }] })).toBeNull();
	expect(codexModelsFromCache("lixo")).toBeNull();
});
