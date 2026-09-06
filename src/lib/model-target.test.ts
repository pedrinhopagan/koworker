import { expect, test } from "bun:test";

import type { CliModelOption } from "@/api/schemas/agent-radar";
import { modelOptionLabel, modelTargetDiff, sessionModelId } from "./model-target";

const CLAUDE: CliModelOption[] = [
	{ id: "fable", label: "Fable 5.1", hint: "", efforts: ["low", "high"], defaultEffort: null },
	{ id: "opus", label: "Opus 5", hint: "", efforts: ["low", "high"], defaultEffort: null },
];

test("o id do transcript casa com o apelido do catálogo", () => {
	expect(sessionModelId(CLAUDE, "claude-fable-5-1")).toBe("fable");
	expect(sessionModelId(CLAUDE, "opus")).toBe("opus");
	expect(sessionModelId(CLAUDE, "claude-mythos-5-1")).toBe("claude-mythos-5-1");
	expect(sessionModelId(undefined, "gpt-6-astra")).toBe("gpt-6-astra");
	expect(sessionModelId(CLAUDE, null)).toBeNull();
	expect(modelOptionLabel(CLAUDE, "fable")).toBe("Fable 5.1");
	expect(modelOptionLabel(CLAUDE, "claude-mythos-5-1")).toBe("Mythos 5.1");
});

test("só o que difere da sessão vira troca", () => {
	const session = { cli: "claude" as const, model: "fable", effort: "high" };

	expect(modelTargetDiff({ cli: "claude", model: "fable", effort: "high" }, session)).toBeNull();
	expect(modelTargetDiff({ cli: "claude", model: null, effort: null }, session)).toBeNull();
	expect(modelTargetDiff({ cli: "claude", model: "opus", effort: "high" }, session)).toEqual({
		cli: false,
		model: "opus",
	});
	expect(modelTargetDiff({ cli: "claude", model: "fable", effort: "max" }, session)).toEqual({
		cli: false,
		effort: "max",
	});
	expect(modelTargetDiff({ cli: "codex", model: null, effort: null }, session)).toEqual({
		cli: true,
	});
	expect(modelTargetDiff({ cli: "codex", model: "gpt-6-astra", effort: "high" }, session)).toEqual({
		cli: true,
		model: "gpt-6-astra",
		effort: "high",
	});
});
