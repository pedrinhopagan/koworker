import { expect, test } from "bun:test";

import { buildClaudeCommand } from "./claude-command";

test("permissionMode bypass usa o atalho --dangerously-skip-permissions", () => {
	expect(buildClaudeCommand({ prompt: "oi", permissionMode: "bypass" })).toBe(
		'claude --dangerously-skip-permissions "oi"',
	);
});

test("outros modos viram --permission-mode <x>", () => {
	expect(buildClaudeCommand({ prompt: "oi", permissionMode: "plan" })).toBe(
		'claude --permission-mode plan "oi"',
	);
});

test("agent, model e effort entram como flags na ordem estável", () => {
	expect(
		buildClaudeCommand({
			prompt: "faz algo",
			permissionMode: "default",
			agent: "kw",
			model: "opus",
			effort: "high",
		}),
	).toBe('claude --permission-mode default --agent kw --model opus --effort high "faz algo"');
});

test("o prompt é escapado pra caber entre aspas sem expandir $/crase", () => {
	expect(
		buildClaudeCommand({ prompt: 'diga "$HOME" e `date` com \\', permissionMode: "bypass" }),
	).toBe('claude --dangerously-skip-permissions "diga \\"\\$HOME\\" e \\`date\\` com \\\\"');
});
