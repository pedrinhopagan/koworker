import type { RadarAgent } from "@/api/schemas/terminal-workspace";
import { sortRadarAgents } from "@/lib/agent-radar-status";

export type AgentGroup = {
	id: string;
	projectId: string | null;
	label: string;
	workspaceLabels: string[];
	agents: RadarAgent[];
};

function cwdLabel(cwd: string) {
	return cwd.replace(/\/+$/, "").split("/").at(-1) || cwd;
}

export function groupAgentsByProject(agents: RadarAgent[]): AgentGroup[] {
	const groups = new Map<
		string,
		{
			id: string;
			projectId: string | null;
			label: string;
			workspaceLabels: Set<string>;
			agents: RadarAgent[];
		}
	>();

	for (const agent of agents) {
		const id = agent.projectId ? `project:${agent.projectId}` : `cwd:${agent.cwd}`;
		const group = groups.get(id);

		if (group) {
			group.agents.push(agent);
			group.workspaceLabels.add(agent.workspaceLabel);
			continue;
		}

		groups.set(id, {
			id,
			projectId: agent.projectId,
			label: agent.projectName ?? cwdLabel(agent.cwd),
			workspaceLabels: new Set([agent.workspaceLabel]),
			agents: [agent],
		});
	}

	const result: AgentGroup[] = [];

	for (const group of groups.values()) {
		result.push({
			id: group.id,
			projectId: group.projectId,
			label: group.label,
			workspaceLabels: [...group.workspaceLabels].sort(),
			agents: sortRadarAgents(group.agents),
		});
	}

	return result.sort(function (left, right) {
		return left.label.localeCompare(right.label);
	});
}
