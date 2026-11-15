import { expect, test } from "bun:test";

import { legacyTerminalRedirect } from "./legacy-terminal-redirect";

test("lista antiga chega ao chat canônico com replace", () => {
	expect(legacyTerminalRedirect()).toEqual({ to: "/chat", replace: true });
});

test("deep link antigo preserva a identidade do pane", () => {
	expect(legacyTerminalRedirect("pane-7")).toEqual({
		to: "/chat",
		search: { paneId: "pane-7" },
		replace: true,
	});
});
