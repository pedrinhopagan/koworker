import { expect, test } from "bun:test";

import { buildClaudeArgv } from "@/lib/claude-command";
import { terminalCommandText } from "./command";

test("o kw-terminal recebe o argv serializado com quoting POSIX", () => {
	expect(
		terminalCommandText({
			kind: "argv",
			argv: buildClaudeArgv({ prompt: "faça `date`", permissionMode: "plan" }),
		}),
	).toBe("claude --permission-mode plan 'faça `date`'");
});
