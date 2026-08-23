import { describe, expect, test } from "bun:test";

import type { ShellRecord } from "@/api/helpers/shells/supervisor";
import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import {
	agentTabKey,
	groupShellsAndAgents,
	parseAgentPaneId,
	parseShellTabKey,
} from "./shell-groups";

function shell(overrides: Partial<ShellRecord>): ShellRecord {
	return {
		id: "shell-1",
		label: "Shell 1",
		cwd: "/tmp/projeto",
		projectId: null,
		cols: 80,
		rows: 24,
		createdAt: 1_000,
		title: null,
		status: "live",
		exitCode: null,
		...overrides,
	};
}

function agent(overrides: Partial<RadarAgent>): RadarAgent {
	return {
		paneId: "pane-1",
		workspaceId: "ws",
		workspaceLabel: "dev",
		tabId: "tab-1",
		tabLabel: "tab",
		agent: "claude",
		status: "idle",
		activity: null,
		title: null,
		cwd: "/tmp/projeto",
		projectId: null,
		projectName: null,
		sessionId: null,
		sessionPath: null,
		taskId: null,
		taskTitle: null,
		changedAt: 1_000,
		...overrides,
	};
}

const PROJECTS = [
	{ id: "p1", name: "Koworker", color: "#ff0000" },
	{ id: "p2", name: "Dogama", color: "#00ff00" },
];

describe("parse de tab", () => {
	test("chave de shell não pode começar com agent:", () => {
		expect(parseShellTabKey("shell-3")).toBe("shell-3");
		expect(parseShellTabKey("agent:pane-1")).toBeNull();
		expect(parseShellTabKey("")).toBeNull();
	});

	test("chave de agent extrai o paneId", () => {
		expect(parseAgentPaneId(agentTabKey("pane-9"))).toBe("pane-9");
		expect(parseAgentPaneId("shell-2")).toBeNull();
	});
});

describe("groupShellsAndAgents", () => {
	test("agrupa pelo projeto quando existe e pela pasta quando não há", () => {
		const groups = groupShellsAndAgents(
			[
				shell({ id: "a", projectId: "p1", cwd: "/mnt/kw" }),
				shell({ id: "b", projectId: null, cwd: "/tmp/outro/" }),
			],
			[agent({ paneId: "x", projectId: "p1", projectName: "Ignorado" })],
			PROJECTS,
		);

		expect(groups.map((group) => group.label)).toEqual(["Koworker", "outro"]);
		const kw = groups[0];
		expect(kw?.color).toBe("#ff0000");
		expect(kw?.entries.map((entry) => entry.kind)).toEqual(["agent", "shell"]);
	});

	test("agents primeiro na régua do radar, shells do mais novo pro mais velho", () => {
		const groups = groupShellsAndAgents(
			[shell({ id: "novo", createdAt: 200 }), shell({ id: "velho", createdAt: 100 })],
			[
				agent({ paneId: "trabalhando", status: "working" }),
				agent({ paneId: "bloqueado", status: "blocked" }),
				agent({ paneId: "parado", status: "idle" }),
			],
			[],
		);

		expect(groups).toHaveLength(1);
		expect(
			groups[0]?.entries.map((entry) => (entry.kind === "agent" ? entry.agent.paneId : entry.key)),
		).toEqual(["bloqueado", "trabalhando", "parado", "novo", "velho"]);
	});

	test("sem nada aberto a lista é vazia", () => {
		expect(groupShellsAndAgents([], [], [])).toEqual([]);
	});
});
