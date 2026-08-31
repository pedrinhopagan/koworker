import { describe, expect, test } from "bun:test";

import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import {
	agentTabKey,
	groupTerminalWorkspaceEntries,
	parseAgentPaneId,
	parseShellTabKey,
	terminalWorkspaceEntryDescription,
} from "./shell-groups";

type ShellEntry = Extract<TerminalWorkspaceEntry, { kind: "shell" }>;
type AgentEntry = Extract<TerminalWorkspaceEntry, { kind: "agent" }>;

const SHELL_CAPABILITIES = {
	rename: true,
	close: true,
	converse: false,
	interrupt: false,
	focusExternal: false,
	diff: false,
	replay: true,
	scroll: true,
	resize: true,
};

const AGENT_CAPABILITIES = {
	...SHELL_CAPABILITIES,
	rename: false,
	converse: true,
	interrupt: true,
	focusExternal: true,
	diff: true,
};

function shell(overrides: Partial<ShellEntry> = {}): ShellEntry {
	return {
		key: "shell-1",
		kind: "shell",
		id: "shell-1",
		label: "Shell 1",
		groupLabel: "/tmp/projeto",
		cwd: "/tmp/projeto",
		projectId: null,
		projectName: null,
		agent: null,
		taskId: null,
		taskTitle: null,
		status: "live",
		statusFidelity: "activity",
		title: null,
		activity: null,
		createdAt: 1_000,
		changedAt: 1_000,
		exitCode: null,
		capabilities: SHELL_CAPABILITIES,
		...overrides,
	};
}

function agent(overrides: Partial<AgentEntry> = {}): AgentEntry {
	return {
		key: "agent:pane-1",
		kind: "agent",
		id: "pane-1",
		label: "tab",
		groupLabel: "dev",
		cwd: "/tmp/projeto",
		projectId: null,
		projectName: null,
		agent: "claude",
		taskId: null,
		taskTitle: null,
		status: "idle",
		statusFidelity: "semantic",
		title: null,
		activity: null,
		createdAt: null,
		changedAt: 1_000,
		exitCode: null,
		capabilities: AGENT_CAPABILITIES,
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

describe("terminalWorkspaceEntryDescription", () => {
	test("título do terminal vira descrição", () => {
		expect(terminalWorkspaceEntryDescription(shell({ title: "claude --continue" }))).toBe(
			"claude --continue",
		);
	});

	test("título que é a rota não se repete", () => {
		expect(terminalWorkspaceEntryDescription(shell({ title: "/tmp/projeto" }))).toBeNull();
		expect(terminalWorkspaceEntryDescription(shell({ title: "/tmp/projeto " }))).toBeNull();
		expect(terminalWorkspaceEntryDescription(shell({ title: "/tmp/projeto --flag" }))).toBeNull();
		expect(terminalWorkspaceEntryDescription(shell({ title: "projeto" }))).toBeNull();
	});
});

describe("groupTerminalWorkspaceEntries", () => {
	test("agrupa pelo projeto quando existe e pela pasta quando não há", () => {
		const groups = groupTerminalWorkspaceEntries(
			[
				shell({ key: "a", id: "a", projectId: "p1", cwd: "/mnt/kw" }),
				shell({ key: "b", id: "b", cwd: "/tmp/outro/", groupLabel: "/tmp/outro/" }),
				agent({ key: "agent:x", id: "x", projectId: "p1", projectName: "Ignorado" }),
			],
			PROJECTS,
		);

		expect(groups.map((group) => group.label)).toEqual(["Koworker", "outro"]);
		expect(groups[0]?.color).toBe("#ff0000");
		expect(groups[0]?.entries.map((entry) => entry.kind)).toEqual(["agent", "shell"]);
	});

	test("agents primeiro na régua do radar, shells do mais novo pro mais velho", () => {
		const groups = groupTerminalWorkspaceEntries(
			[
				shell({ key: "novo", id: "novo", createdAt: 200 }),
				shell({ key: "velho", id: "velho", createdAt: 100 }),
				agent({ key: "agent:trabalhando", id: "trabalhando", status: "working" }),
				agent({ key: "agent:bloqueado", id: "bloqueado", status: "blocked" }),
				agent({ key: "agent:parado", id: "parado", status: "idle" }),
			],
			[],
		);

		expect(groups[0]?.entries.map((entry) => entry.id)).toEqual([
			"bloqueado",
			"trabalhando",
			"parado",
			"novo",
			"velho",
		]);
	});

	test("sem nada aberto a lista é vazia", () => {
		expect(groupTerminalWorkspaceEntries([], [])).toEqual([]);
	});
});
