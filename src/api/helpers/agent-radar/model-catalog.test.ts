import { expect, test } from "bun:test";

import { claudeModelsFromCache, codexModelsFromCache } from "./model-catalog";

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
			label: "GPT-6-Astra",
			hint: "",
			efforts: ["medium"],
			defaultEffort: null,
			legacy: false,
		},
		{
			id: "gpt-5.6-sol",
			label: "GPT-5.6-Sol",
			hint: "Reliable agentic workhorse.",
			efforts: ["low", "high", "ultra"],
			defaultEffort: "low",
			legacy: false,
		},
	]);
});

test("cache ilegível ou vazio devolve nulo para cair no catálogo fixo", () => {
	expect(codexModelsFromCache({ models: [] })).toBeNull();
	expect(codexModelsFromCache({ models: [{ slug: "x", visibility: "hide" }] })).toBeNull();
	expect(codexModelsFromCache("lixo")).toBeNull();
});

test("catálogo do Claude sai do cache do próprio CLI, com esforço padrão e versões anteriores", () => {
	const models = claudeModelsFromCache({
		version: 2,
		catalog: {
			surface: "cc",
			config: {
				id: "cc",
				models: [
					{
						id: "claude-opus-5-5",
						name: "Opus 5.5",
						description: "Most capable for ambitious work",
						section: "main",
						thinking: {
							type: "effort",
							effort_options: [
								{ id: "low", name: "Low" },
								{ id: "medium", name: "Medium", badge: { message: "Default" } },
								{ id: "max", name: "Max" },
							],
						},
					},
					{
						id: "claude-haiku-4-5-20251001",
						name: "Haiku 4.5",
						section: "main",
						thinking: { type: "none" },
					},
					{ id: "claude-opus-5", name: "Opus 5", section: "overflow" },
				],
			},
		},
	});

	expect(models).toEqual([
		{
			id: "claude-opus-5-5",
			label: "Opus 5.5",
			hint: "Most capable for ambitious work",
			efforts: ["low", "medium", "max"],
			defaultEffort: "medium",
			legacy: false,
		},
		{
			id: "claude-haiku-4-5-20251001",
			label: "Haiku 4.5",
			hint: "",
			efforts: [],
			defaultEffort: null,
			legacy: false,
		},
		{
			id: "claude-opus-5",
			label: "Opus 5",
			hint: "",
			efforts: [],
			defaultEffort: null,
			legacy: true,
		},
	]);
	expect(claudeModelsFromCache({ catalog: { config: { models: [] } } })).toBeNull();
});
