import { expect, test } from "bun:test";

import { legacyTerminalRedirect } from "./legacy-terminal-redirect";

test("lista antiga chega ao workspace canônico com replace", () => {
	expect(legacyTerminalRedirect()).toEqual({ to: "/shells", replace: true });
});

test("deep link antigo preserva a identidade do pane", () => {
	expect(legacyTerminalRedirect("pane-7")).toEqual({
		to: "/shells",
		search: { tab: "agent:pane-7" },
		replace: true,
	});
});
