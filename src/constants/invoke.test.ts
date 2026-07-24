import { describe, expect, test } from "bun:test";

import {
	CODEX_MODEL_OPTIONS,
	normalizeCodexModel,
	resolveSkillEffortPreference,
	resolveSkillModelPreference,
} from "@/constants/invoke";

describe("preferências portáveis de skill", () => {
	test("cada CLI traduz a intenção para seus próprios modelos", () => {
		expect(resolveSkillModelPreference("smartest", "claude")).toBe("opus");
		expect(resolveSkillModelPreference("balanced", "claude")).toBe("sonnet");
		expect(resolveSkillModelPreference("fastest", "claude")).toBe("haiku");
		expect(resolveSkillModelPreference("smartest", "codex")).toBe("gpt-5.6-sol");
		expect(resolveSkillModelPreference("balanced", "codex")).toBe("gpt-5.6-terra");
		expect(resolveSkillModelPreference("fastest", "codex")).toBe("gpt-5.6-luna");
	});

	test("oferece os três modelos GPT-5.6 com os IDs aceitos pelo Codex", () => {
		expect(
			CODEX_MODEL_OPTIONS.filter((option) => option.value.startsWith("gpt-5.6")).map(
				(option) => option.value,
			),
		).toEqual(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
	});

	test("migra o ID genérico do GPT-5.6 para Sol", () => {
		expect(normalizeCodexModel("gpt-5.6")).toBe("gpt-5.6-sol");
		expect(normalizeCodexModel("gpt-5.6-terra")).toBe("gpt-5.6-terra");
	});

	test("ausência herda e esforço máximo respeita o limite do Codex", () => {
		expect(resolveSkillModelPreference(undefined, "claude")).toBe("inherit");
		expect(resolveSkillEffortPreference(undefined, "codex")).toBe("inherit");
		expect(resolveSkillEffortPreference("max", "claude")).toBe("max");
		expect(resolveSkillEffortPreference("max", "codex")).toBe("xhigh");
	});

	test("preserva IDs concretos legados", () => {
		expect(resolveSkillModelPreference("modelo-local", "claude")).toBe("modelo-local");
		expect(resolveSkillEffortPreference("xhigh", "codex")).toBe("xhigh");
	});
});
