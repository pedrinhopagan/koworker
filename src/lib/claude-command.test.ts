import { expect, test } from "bun:test";

import { buildClaudeCommand, buildClaudePrintArgs } from "./claude-command";

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

test("background usa modo print sem sessão interativa", () => {
	expect(
		buildClaudeCommand({ prompt: "/mobile faça", permissionMode: "bypass", headless: true }),
	).toBe('claude -p --dangerously-skip-permissions "/mobile faça"');
});

test("execução headless cria e retoma sessões identificadas", () => {
	expect(
		buildClaudePrintArgs({
			prompt: "primeiro turno",
			permissionMode: "bypass",
			sessionId: "run-1",
		}),
	).toEqual([
		"claude",
		"-p",
		"--dangerously-skip-permissions",
		"--session-id",
		"run-1",
		"primeiro turno",
	]);
	expect(
		buildClaudePrintArgs({
			prompt: "segundo turno",
			permissionMode: "bypass",
			resumeSessionId: "run-1",
		}),
	).toContain("--resume");
});
