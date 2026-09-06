import { expect, test } from "bun:test";

import {
	cliResumeArgv,
	cliResumeByIdArgv,
	cliStartArgv,
	cliStartWithFullAccessArgv,
} from "./cli-argv";

test("início interativo do Claude preserva opções seguras", () => {
	expect(
		cliStartArgv({
			cli: "claude",
			prompt: "comece",
			permissionMode: "acceptEdits",
			agent: "reviewer",
			model: "opus",
			effort: "high",
		}),
	).toEqual([
		"claude",
		"--permission-mode",
		"acceptEdits",
		"--agent",
		"reviewer",
		"--model",
		"opus",
		"--effort",
		"high",
		"comece",
	]);
});

test("início interativo do Codex preserva opções seguras", () => {
	expect(
		cliStartArgv({
			cli: "codex",
			prompt: "comece",
			approvalMode: "readOnly",
			model: "gpt-5.6-sol",
			effort: "xhigh",
		}),
	).toEqual([
		"codex",
		"--sandbox",
		"read-only",
		"-m",
		"gpt-5.6-sol",
		"-c",
		"model_reasoning_effort=xhigh",
		"comece",
	]);
});

test("atalho global abre os agentes com acesso irrestrito", () => {
	expect(cliStartWithFullAccessArgv("codex")).toEqual(["codex", "--yolo"]);
	expect(cliStartWithFullAccessArgv("pi")).toEqual(["pi"]);
	expect(cliStartWithFullAccessArgv("claude")).toEqual([
		"claude",
		"--dangerously-skip-permissions",
	]);
});

test("início e retomada interativos nunca usam flags perigosas", () => {
	const commands = [
		cliStartArgv({ cli: "claude" }),
		cliStartArgv({ cli: "codex" }),
		cliResumeArgv("claude"),
		cliResumeArgv("codex"),
	];

	for (const argv of commands) {
		expect(argv.join(" ")).not.toContain("dangerously");
	}
	expect(cliResumeArgv("claude")).toEqual(["claude", "--continue"]);
	expect(cliResumeArgv("codex")).toEqual(["codex", "resume", "--last"]);
});

test("retomada por id aceita modelo, esforço e acesso total", () => {
	expect(cliResumeByIdArgv("codex", "thread-1")).toEqual(["codex", "resume", "thread-1"]);
	expect(
		cliResumeByIdArgv("codex", "thread-1", {
			model: "gpt-6-astra",
			effort: "high",
			fullAccess: true,
		}),
	).toEqual([
		"codex",
		"resume",
		"--dangerously-bypass-approvals-and-sandbox",
		"-m",
		"gpt-6-astra",
		"-c",
		"model_reasoning_effort=high",
		"thread-1",
	]);
	expect(cliResumeByIdArgv("claude", "sess-1", { model: "opus", fullAccess: true })).toEqual([
		"claude",
		"--resume",
		"sess-1",
		"--dangerously-skip-permissions",
		"--model",
		"opus",
	]);
});
