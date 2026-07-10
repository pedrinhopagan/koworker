import { describe, expect, test } from "bun:test";

import { buildCodexCommand, buildCodexExecArgs } from "./codex-command";

describe("buildCodexExecArgs", () => {
	test("monta execução headless com escrita e cwd", () => {
		expect(
			buildCodexExecArgs({
				prompt: "$mobile faça a tarefa",
				approvalMode: "bypass",
				model: "gpt-5.5",
				effort: "high",
				cwd: "/projeto",
			}),
		).toEqual([
			"codex",
			"exec",
			"-m",
			"gpt-5.5",
			"-c",
			"model_reasoning_effort=high",
			"--ephemeral",
			"--skip-git-repo-check",
			"-C",
			"/projeto",
			"--dangerously-bypass-approvals-and-sandbox",
			"$mobile faça a tarefa",
		]);
	});
});

describe("buildCodexCommand", () => {
	test("mantém TUI no desktop", () => {
		expect(buildCodexCommand({ prompt: "teste", approvalMode: "bypass" })).toBe(
			'codex --dangerously-bypass-approvals-and-sandbox "teste"',
		);
	});

	test("usa codex exec em background", () => {
		expect(buildCodexCommand({ prompt: "teste", approvalMode: "readOnly", headless: true })).toBe(
			'codex exec --ephemeral --skip-git-repo-check --sandbox read-only "teste"',
		);
	});
});
