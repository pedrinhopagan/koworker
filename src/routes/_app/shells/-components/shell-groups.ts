import type { ShellRecord } from "@/api/helpers/shells/supervisor";
import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { sortRadarAgents } from "@/lib/agent-radar-status";

export type ProjectSummary = { id: string; name: string; color: string };

export type ShellSidebarEntry =
	| { kind: "shell"; key: string; shell: ShellRecord }
	| { kind: "agent"; key: string; agent: RadarAgent };

export type ShellGroup = {
	id: string;
	projectId: string | null;
	label: string;
	cwd: string;
	color: string | null;
	entries: ShellSidebarEntry[];
};

export function agentTabKey(paneId: string): string {
	return `agent:${paneId}`;
}

export function parseShellTabKey(tab: string | undefined): string | null {
	if (!tab || tab.startsWith("agent:")) {
		return null;
	}

	return tab;
}

export function parseAgentPaneId(tab: string | undefined): string | null {
	if (!tab?.startsWith("agent:")) {
		return null;
	}

	return tab.slice("agent:".length);
}

function cwdLabel(cwd: string) {
	return cwd.replace(/\/+$/, "").split("/").at(-1) || cwd;
}

export function groupShellsAndAgents(
	shells: ShellRecord[],
	agents: RadarAgent[],
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
			entries: ShellSidebarEntry[];
		}
	>();

	function groupFor(projectId: string | null, label: string, cwd: string) {
		const id = projectId ? `project:${projectId}` : `cwd:${cwd}`;

		let group = groups.get(id);
		if (!group) {
			group = { id, projectId, label, cwd, entries: [] };
			groups.set(id, group);
		}

		return group;
	}

	for (const shell of shells) {
		const project = shell.projectId ? projectById.get(shell.projectId) : null;

		const group = project
			? groupFor(project.id, project.name, shell.cwd)
			: groupFor(null, cwdLabel(shell.cwd), shell.cwd);

		group.entries.push({ kind: "shell", key: shell.id, shell });
	}

	for (const agent of agents) {
		const project = agent.projectId ? projectById.get(agent.projectId) : null;

		const group = project
			? groupFor(project.id, project.name, agent.cwd)
			: groupFor(null, agent.workspaceLabel || cwdLabel(agent.cwd), agent.cwd);

		group.entries.push({ kind: "agent", key: agentTabKey(agent.paneId), agent });
	}

	const result: ShellGroup[] = [];

	for (const group of groups.values()) {
		const agentsSorted = sortRadarAgents(
			group.entries.flatMap((entry) => (entry.kind === "agent" ? [entry.agent] : [])),
		);
		const shellsSorted = group.entries
			.flatMap((entry) => (entry.kind === "shell" ? [entry.shell] : []))
			.sort((left, right) => right.createdAt - left.createdAt);

		result.push({
			id: group.id,
			projectId: group.projectId,
			label: group.label,
			cwd: group.cwd,
			color: group.projectId ? (projectById.get(group.projectId)?.color ?? null) : null,
			entries: [
				...agentsSorted.map((agent) => ({
					kind: "agent" as const,
					key: agentTabKey(agent.paneId),
					agent,
				})),
				...shellsSorted.map((shell) => ({ kind: "shell" as const, key: shell.id, shell })),
			],
		});
	}

	return result.sort(function (left, right) {
		return left.label.localeCompare(right.label);
	});
}
