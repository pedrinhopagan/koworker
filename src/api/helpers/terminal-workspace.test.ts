import { expect, test } from "bun:test";

import { shouldEmitTerminalWorkspaceSnapshot } from "./terminal-workspace-revision";

test("catálogo inicial e eventos concorrentes não duplicam revisões", () => {
	expect(shouldEmitTerminalWorkspaceSnapshot(7, 7)).toBe(false);
	expect(shouldEmitTerminalWorkspaceSnapshot(7, 6)).toBe(false);
	expect(shouldEmitTerminalWorkspaceSnapshot(7, 8)).toBe(true);
});
