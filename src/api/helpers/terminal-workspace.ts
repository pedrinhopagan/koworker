import type {
	TerminalWorkspaceEntry,
	TerminalWorkspaceSnapshot,
} from "@/api/schemas/terminal-workspace";

import { getRadarFocus, listRadarAgents } from "./agent-radar/state";
import { transcriptCli } from "./agent-radar/transcript/locate";
import { shellRuntime } from "./shells/supervisor";
import { getTerminalWorkspaceRevision } from "./terminal-workspace-events";

const SHELL_CONVERSE_AGENTS = new Set(["claude", "codex", "pi"]);

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
} as const;

const AGENT_CAPABILITIES = {
	rename: false,
	close: true,
	converse: true,
	interrupt: true,
	focusExternal: true,
	diff: true,
	replay: true,
	scroll: true,
	resize: true,
} as const;

export function terminalWorkspaceSnapshot(): TerminalWorkspaceSnapshot {
	const shellEntries: TerminalWorkspaceEntry[] = shellRuntime.snapshot().map((shell) => ({
		key: shell.id,
		kind: "shell",
		id: shell.id,
		label: shell.label,
		groupLabel: shell.cwd,
		cwd: shell.cwd,
		projectId: shell.projectId,
		projectName: null,
		agent: shell.agent,
		taskId: null,
		taskTitle: null,
		status: shell.agentStatus ?? shell.status,
		statusFidelity: "activity",
		title: shell.title,
		activity: null,
		createdAt: shell.createdAt,
		changedAt: shell.agentStatusAt,
		exitCode: shell.exitCode,
		capabilities: {
			...SHELL_CAPABILITIES,
			converse: shell.status === "live" && SHELL_CONVERSE_AGENTS.has(shell.agent ?? ""),
		},
	}));

	const agentEntries: TerminalWorkspaceEntry[] = listRadarAgents().map((agent) => ({
		key: `agent:${agent.paneId}`,
		kind: "agent",
		id: agent.paneId,
		label: agent.tabLabel,
		groupLabel: agent.workspaceLabel,
		cwd: agent.cwd,
		projectId: agent.projectId,
		projectName: agent.projectName,
		agent: agent.agent,
		taskId: agent.taskId,
		taskTitle: agent.taskTitle,
		status: agent.status,
		statusFidelity: "semantic",
		title: agent.title,
		activity: agent.activity,
		createdAt: null,
		changedAt: agent.changedAt,
		exitCode: null,
		// Sem transcript legível (gemini, pi…) não existe conversa: o pane abre no terminal, e o
		// composer de lá é o chat.
		capabilities: { ...AGENT_CAPABILITIES, converse: !!transcriptCli(agent.agent) },
	}));

	return {
		revision: getTerminalWorkspaceRevision(),
		entries: [...agentEntries, ...shellEntries],
		focus: getRadarFocus(),
	};
}
