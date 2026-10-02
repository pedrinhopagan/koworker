import { describe, expect, test } from "bun:test";

import { TerminalWorkspaceEntrySchema } from "@/api/schemas/terminal-workspace";

const base = {
	key: "shell-1",
	id: "shell-1",
	label: "Shell 1",
	groupLabel: "/tmp",
	cwd: "/tmp",
	projectId: null,
	projectName: null,
	agent: null,
	taskId: null,
	taskTitle: null,
	status: "live",
	title: null,
	activity: null,
	createdAt: 1,
	changedAt: 1,
	exitCode: null,
};

describe("contrato do workspace de terminais", () => {
	test("shell declara fidelidade de atividade e somente suas capacidades", () => {
		const parsed = TerminalWorkspaceEntrySchema.parse({
			...base,
			kind: "shell",
			statusFidelity: "activity",
			capabilities: {
				rename: true,
				close: true,
				converse: false,
				interrupt: false,
				focusExternal: false,
				diff: false,
				replay: true,
				scroll: true,
				resize: true,
			},
		});

		expect(parsed.kind).toBe("shell");
		expect(parsed.capabilities.converse).toBe(false);
		expect(parsed.statusFidelity).toBe("activity");
	});

	test("agent expõe ações sem vazar o protocolo de tela", () => {
		const parsed = TerminalWorkspaceEntrySchema.parse({
			...base,
			key: "agent:pane-1",
			id: "pane-1",
			kind: "agent",
			agent: "codex",
			status: "blocked",
			statusFidelity: "semantic",
			createdAt: null,
			capabilities: {
				rename: false,
				close: true,
				converse: true,
				interrupt: true,
				focusExternal: true,
				diff: true,
				replay: true,
				scroll: true,
				resize: true,
			},
		});

		expect(parsed.kind).toBe("agent");
		expect(parsed.capabilities.focusExternal).toBe(true);
		expect("ansi" in parsed).toBe(false);
		expect("b64" in parsed).toBe(false);
	});
});
