import { describe, expect, test } from "bun:test";

import type {
	TerminalWorkspaceEntry,
	TerminalWorkspaceSnapshot,
} from "@/api/schemas/terminal-workspace";
import {
	reconcileTerminalWorkspaceSnapshot,
	resolveTerminalWorkspaceSelection,
} from "./terminal-workspace-state";

const CAPABILITIES = {
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

function entry(id: string, status: "live" | "exited" = "live"): TerminalWorkspaceEntry {
	return {
		key: id,
		kind: "shell",
		id,
		label: id,
		groupLabel: "/tmp",
		cwd: "/tmp",
		projectId: null,
		projectName: null,
		agent: null,
		taskId: null,
		taskTitle: null,
		status,
		statusFidelity: "activity",
		title: null,
		activity: null,
		createdAt: 1,
		changedAt: 1,
		exitCode: status === "exited" ? 0 : null,
		capabilities: CAPABILITIES,
	};
}

function snapshot(revision: number, entries: TerminalWorkspaceEntry[]): TerminalWorkspaceSnapshot {
	return {
		revision,
		entries,
		focus: { workspaceId: null, tabId: null, paneId: null },
	};
}

describe("resolveTerminalWorkspaceSelection", () => {
	test("mantém seleção existente e não inventa seleção inicial", () => {
		const entries = [entry("a"), entry("b")];

		expect(resolveTerminalWorkspaceSelection(entries, "b")).toBe("b");
		expect(resolveTerminalWorkspaceSelection(entries)).toBeNull();
	});

	test("item removido escolhe deterministicamente o primeiro restante", () => {
		expect(resolveTerminalWorkspaceSelection([entry("a"), entry("b")], "sumiu")).toBe("a");
		expect(resolveTerminalWorkspaceSelection([], "sumiu")).toBeNull();
	});
});

describe("reconcileTerminalWorkspaceSnapshot", () => {
	test("preserva identidade de entradas que não mudaram", () => {
		const currentEntry = entry("a");
		const next = reconcileTerminalWorkspaceSnapshot(
			snapshot(1, [currentEntry]),
			snapshot(2, [entry("a")]),
		);

		expect(next.entries[0]).toBe(currentEntry);
		expect(next.revision).toBe(2);
	});

	test("substitui entrada quando o estado observável muda", () => {
		const currentEntry = entry("a");
		const next = reconcileTerminalWorkspaceSnapshot(
			snapshot(1, [currentEntry]),
			snapshot(2, [entry("a", "exited")]),
		);

		expect(next.entries[0]).not.toBe(currentEntry);
		expect(next.entries[0]?.status).toBe("exited");
	});
});
