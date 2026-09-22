import { expect, test } from "bun:test";
import { agentPromptInput } from "./agent-prompt-input";

test("Claude recebe texto digitado e Shift+Enter entre linhas", () => {
	expect(agentPromptInput("claude", "linha um\n\tlinha dois")).toBe(
		"linha um\u001B[13;2u    linha dois",
	);
});

test("Codex recebe uma colagem literal com quebras de linha", () => {
	expect(agentPromptInput("codex", "linha um\nlinha dois")).toBe(
		"\u001B[200~linha um\nlinha dois\u001B[201~",
	);
});
