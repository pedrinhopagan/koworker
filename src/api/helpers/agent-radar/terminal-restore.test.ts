import { expect, test } from "bun:test";

import { groupSavedTerminals } from "./terminal-restore";

test("agrupa panes da mesma tab em um único terminal", () => {
	const terminals = groupSavedTerminals([
		{ id: "pane-a", workspace_label: "kw_app", tab_label: "main", cwd: "/app" },
		{ id: "pane-b", workspace_label: "kw_app", tab_label: "main", cwd: "/app" },
		{ id: "pane-c", workspace_label: "kw_app", tab_label: "review", cwd: "/app" },
	]);

	expect(terminals).toEqual([
		{
			key: "kw_app\0main",
			ids: ["pane-a", "pane-b"],
			workspaceLabel: "kw_app",
			tabLabel: "main",
			cwd: "/app",
		},
		{
			key: "kw_app\0review",
			ids: ["pane-c"],
			workspaceLabel: "kw_app",
			tabLabel: "review",
			cwd: "/app",
		},
	]);
});
