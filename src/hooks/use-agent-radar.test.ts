import { expect, test } from "bun:test";

import type { RadarAgent } from "@/api/schemas/terminal-workspace";
import { reconcileRadarAgents } from "./use-agent-radar";

function agent(paneId: string, status: RadarAgent["status"]): RadarAgent {
	return {
		paneId,
		workspaceId: "w1",
		workspaceLabel: "w",
		tabId: "t1",
		tabLabel: "1",
		agent: "claude",
		status,
		activity: null,
		title: null,
		cwd: "/tmp",
		projectId: null,
		projectName: null,
		sessionId: null,
		sessionPath: null,
		taskId: null,
		taskTitle: null,
		changedAt: 1,
	};
}

test("snapshot sem mudança preserva a lista e cada cartão", () => {
	const current = [agent("a", "idle"), agent("b", "working")];
	const next = reconcileRadarAgents(current, [agent("a", "idle"), agent("b", "working")]);

	expect(next).toBe(current);
});

test("transição de um agent não troca a identidade dos outros", () => {
	const current = [agent("a", "idle"), agent("b", "working")];
	const next = reconcileRadarAgents(current, [agent("a", "idle"), agent("b", "blocked")]);

	expect(next).not.toBe(current);
	expect(next[0]).toBe(current[0]);
	expect(next[1]).not.toBe(current[1]);
	expect(next[1]?.status).toBe("blocked");
});

test("pane que fecha sai da lista", () => {
	const current = [agent("a", "idle"), agent("b", "working")];
	const next = reconcileRadarAgents(current, [agent("a", "idle")]);

	expect(next).toHaveLength(1);
	expect(next[0]).toBe(current[0]);
});
