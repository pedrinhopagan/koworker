import type { TerminalWorkspaceEntry } from "@/api/schemas/terminal-workspace";
import { agentRadarAgentLabel } from "@/constants/agent-radar";
import { sortRadarAgents } from "@/lib/agent-radar-status";

export type ProjectSummary = { id: string; name: string; color: string };

export type ShellGroup = {
	id: string;
	projectId: string | null;
	label: string;
	cwd: string;
	color: string | null;
	entries: TerminalWorkspaceEntry[];
};

export function agentTabKey(paneId: string) {
	return `agent:${paneId}`;
}

export function parseShellTabKey(tab: string | undefined) {
	if (!tab || tab.startsWith("agent:")) {
		return null;
	}

	return tab;
}

export function parseAgentPaneId(tab: string | undefined) {
	if (!tab?.startsWith("agent:")) {
		return null;
	}

	return tab.slice("agent:".length);
}

function cwdLabel(cwd: string) {
	return cwd.replace(/\/+$/, "").split("/").at(-1) || cwd;
}

export function terminalWorkspaceEntryTitle(entry: TerminalWorkspaceEntry) {
	if (entry.kind === "agent") {
		return entry.taskTitle ?? entry.title ?? entry.projectName ?? entry.label;
	}

	return entry.agent ? agentRadarAgentLabel(entry.agent) : entry.label;
}

export function terminalWorkspaceEntryDescription(entry: TerminalWorkspaceEntry) {
	if (entry.kind === "agent") {
		return entry.activity;
	}

	const title = entry.title?.trim();
	if (!title) {
		return null;
	}

	const cwd = entry.cwd.replace(/\/+$/, "");
	if (title === cwd || title.startsWith(`${cwd} `) || title === cwdLabel(entry.cwd)) {
		return null;
	}

	return title;
}

export function terminalWorkspaceStatusText(entry: TerminalWorkspaceEntry) {
	if (entry.kind === "agent") {
		return entry.status;
	}

	if (entry.status === "working" || entry.status === "idle") {
		return entry.status;
	}

	return entry.status === "live" ? "ativo" : `encerrado (${entry.exitCode ?? "?"})`;
}

export function groupTerminalWorkspaceEntries(
	entries: TerminalWorkspaceEntry[],
	projects: ProjectSummary[],
): ShellGroup[] {
	const projectById = new Map(projects.map((project) => [project.id, project]));
	const groups = new Map<
		string,
		{
			id: string;
			projectId: string | null;
			label: string;
			cwd: string;
			entries: TerminalWorkspaceEntry[];
		}
	>();

	for (const entry of entries) {
		const project = entry.projectId ? projectById.get(entry.projectId) : null;
		const id = project ? `project:${project.id}` : `cwd:${entry.cwd}`;
		let group = groups.get(id);

		if (!group) {
			group = {
				id,
				projectId: project?.id ?? null,
				label: project?.name ?? (entry.kind === "agent" ? entry.groupLabel : cwdLabel(entry.cwd)),
				cwd: entry.cwd,
				entries: [],
			};
			groups.set(id, group);
		}

		group.entries.push(entry);
	}

	return [...groups.values()]
		.map((group) => {
			const agents = sortRadarAgents(group.entries.filter((entry) => entry.kind === "agent"));
			const shells = group.entries
				.filter((entry) => entry.kind === "shell")
				.sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));

			return {
				id: group.id,
				projectId: group.projectId,
				label: group.label,
				cwd: group.cwd,
				color: group.projectId ? (projectById.get(group.projectId)?.color ?? null) : null,
				entries: [...agents, ...shells],
			};
		})
		.sort((left, right) => left.label.localeCompare(right.label));
}
