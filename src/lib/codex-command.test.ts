import { describe, expect, test } from "bun:test";

import { buildCodexArgv, buildCodexExecArgs } from "./codex-command";
import { argvToShellCommand } from "./shell-argv";

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

	test("persiste uma sessão estruturada e retoma pelo id", () => {
		expect(
			buildCodexExecArgs({
				prompt: "primeiro turno",
				approvalMode: "bypass",
				cwd: "/projeto",
				persistSession: true,
				structuredOutput: true,
			}),
		).toEqual([
			"codex",
			"exec",
			"--skip-git-repo-check",
			"-C",
			"/projeto",
			"--dangerously-bypass-approvals-and-sandbox",
			"--json",
			"primeiro turno",
		]);
		expect(
			buildCodexExecArgs({
				prompt: "segundo turno",
				approvalMode: "bypass",
				resumeSessionId: "thread-1",
				structuredOutput: true,
			}),
		).toEqual([
			"codex",
			"exec",
			"resume",
			"--skip-git-repo-check",
			"--dangerously-bypass-approvals-and-sandbox",
			"--json",
			"thread-1",
			"segundo turno",
		]);
	});

	test("traduz modos de sandbox aceitos pelo subcomando resume", () => {
		expect(
			buildCodexExecArgs({
				prompt: "continue",
				approvalMode: "readOnly",
				resumeSessionId: "thread-read",
			}),
		).toEqual([
			"codex",
			"exec",
			"resume",
			"--skip-git-repo-check",
			"-c",
			'sandbox_mode="read-only"',
			"thread-read",
			"continue",
		]);
		expect(
			buildCodexExecArgs({
				prompt: "continue",
				approvalMode: "fullAuto",
				resumeSessionId: "thread-write",
			}),
		).toEqual([
			"codex",
			"exec",
			"resume",
			"--skip-git-repo-check",
			"-c",
			'approval_policy="never"',
			"-c",
			'sandbox_mode="workspace-write"',
			"thread-write",
			"continue",
		]);
	});

	test.each(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])(
		"preserva o ID exato do modelo %s",
		(model) => {
			expect(
				buildCodexExecArgs({
					prompt: "executa",
					approvalMode: "default",
					model,
				}),
			).toContain(model);
		},
	);
});

describe("buildCodexArgv", () => {
	test("mantém TUI no desktop", () => {
		expect(buildCodexArgv({ prompt: "teste", approvalMode: "bypass" })).toEqual([
			"codex",
			"--dangerously-bypass-approvals-and-sandbox",
			"teste",
		]);
	});

	test("usa codex exec em background", () => {
		expect(buildCodexArgv({ prompt: "teste", approvalMode: "readOnly", headless: true })).toEqual([
			"codex",
			"exec",
			"--ephemeral",
			"--skip-git-repo-check",
			"--sandbox",
			"read-only",
			"teste",
		]);
	});

	test("o prompt é um argumento único, sem virar sintaxe de shell", () => {
		const argv = buildCodexArgv({ prompt: "leia $HOME agora!", approvalMode: "fullAuto" });

		expect(argv.at(-1)).toBe("leia $HOME agora!");
		expect(argvToShellCommand(argv)).toBe("codex --full-auto 'leia $HOME agora!'");
	});

	test("metacaractere no modelo continua um único argumento", () => {
		const argv = buildCodexArgv({
			prompt: "oi",
			approvalMode: "default",
			model: "gpt; rm -rf /",
		});

		expect(argv).toEqual(["codex", "-m", "gpt; rm -rf /", "oi"]);
		expect(argvToShellCommand(argv)).toBe("codex -m 'gpt; rm -rf /' oi");
	});
});
