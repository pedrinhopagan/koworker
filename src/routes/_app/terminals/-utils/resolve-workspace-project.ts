import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { sessionNameForProject } from "@/api/helpers/terminal/names";
import type { RouterOutputs } from "@/client";

type Project = RouterOutputs["projects"]["list"][number];

export type WorkspaceProjectRef = {
	id: string;
	name: string;
	mainRoute: string;
	routes: Project["routes"];
};

export type ResolvedWorkspaceProject = {
	displayName: string;
	project: WorkspaceProjectRef | null;
};

function projectFromList(projects: Project[], projectId: string): WorkspaceProjectRef | null {
	const project = projects.find(function (candidate) {
		return candidate.id === projectId;
	});

	if (!project) {
		return null;
	}

	return {
		id: project.id,
		name: project.name,
		mainRoute: project.mainRoute,
		routes: project.routes,
	};
}

function projectIdFromAgents(agents: RadarAgent[]) {
	return (
		agents.find(function (agent) {
			return !!agent.projectId;
		})?.projectId ?? null
	);
}

function projectNameFromAgents(agents: RadarAgent[], projectId: string) {
	return (
		agents.find(function (agent) {
			return agent.projectId === projectId && !!agent.projectName?.trim();
		})?.projectName ?? null
	);
}

export function resolveWorkspaceProject(params: {
	workspaceLabel: string;
	agents: RadarAgent[];
	projects: Project[];
}): ResolvedWorkspaceProject {
	const { workspaceLabel, agents, projects } = params;
	const agentProjectId = projectIdFromAgents(agents);

	if (agentProjectId) {
		const project = projectFromList(projects, agentProjectId);

		if (project) {
			const canonicalLabel = sessionNameForProject(project.name);
			return {
				displayName:
					workspaceLabel === canonicalLabel ? project.name : `${project.name} · ${workspaceLabel}`,
				project,
			};
		}

		const agentName = projectNameFromAgents(agents, agentProjectId);
		const displayName = [agentName, workspaceLabel].find(function (value) {
			return !!value?.trim();
		});

		return {
			displayName: displayName ?? workspaceLabel,
			project: null,
		};
	}

	const byLabel = projects.filter(function (project) {
		return sessionNameForProject(project.name) === workspaceLabel;
	});

	if (byLabel.length === 1) {
		const project = byLabel[0]!;

		return {
			displayName: project.name,
			project: {
				id: project.id,
				name: project.name,
				mainRoute: project.mainRoute,
				routes: project.routes,
			},
		};
	}

	return { displayName: workspaceLabel, project: null };
}
