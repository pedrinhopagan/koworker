import type { AgentRadarStatus } from "@/constants/agent-radar";
import { PubSub } from "../../pubsub";

// Um agent aberto no kw-terminal, do jeito que a central mostra. É reflexo do daemon, que sobrevive
// ao restart do backend: nada disso é persistido, e a subida reconstrói o mapa relistando os panes.
export type RadarAgent = {
	paneId: string;
	workspaceId: string;
	workspaceLabel: string;
	tabId: string;
	tabLabel: string;
	agent: string;
	status: AgentRadarStatus;
	activity: string | null;
	title: string | null;
	cwd: string;
	projectId: string | null;
	projectName: string | null;
	// A sessão do CLI, quando o próprio agent a reporta ao daemon. É o que aponta o transcript sem
	// heurística; nulo aqui é o caso comum de quem subiu sem a integração instalada.
	sessionId: string | null;
	sessionPath: string | null;
	taskId: string | null;
	taskTitle: string | null;
	changedAt: number;
};

const agents = new Map<string, RadarAgent>();

export function listRadarAgents(): RadarAgent[] {
	return [...agents.values()].sort(
		(left, right) =>
			left.workspaceLabel.localeCompare(right.workspaceLabel) ||
			left.tabLabel.localeCompare(right.tabLabel),
	);
}

export function getRadarAgent(paneId: string): RadarAgent | null {
	return agents.get(paneId) ?? null;
}

function publish() {
	return PubSub.publish("agentRadar", "global", { agents: listRadarAgents() });
}

export function putRadarAgent(agent: RadarAgent) {
	agents.set(agent.paneId, agent);

	return publish();
}

export function resetRadarAgents(next: RadarAgent[]) {
	agents.clear();
	for (const agent of next) {
		agents.set(agent.paneId, agent);
	}

	return publish();
}

export function removeRadarPane(paneId: string) {
	if (!agents.delete(paneId)) {
		return;
	}

	return publish();
}

export function removeRadarWorkspace(workspaceId: string) {
	const doomed = [...agents.values()].filter((agent) => agent.workspaceId === workspaceId);

	if (doomed.length === 0) {
		return;
	}

	for (const agent of doomed) {
		agents.delete(agent.paneId);
	}

	return publish();
}

export function renameRadarWorkspace(workspaceId: string, label: string) {
	const affected = [...agents.values()].filter((agent) => agent.workspaceId === workspaceId);

	if (affected.length === 0) {
		return;
	}

	for (const agent of affected) {
		agents.set(agent.paneId, { ...agent, workspaceLabel: label });
	}

	return publish();
}

export function renameRadarTab(tabId: string, label: string) {
	const affected = [...agents.values()].filter((agent) => agent.tabId === tabId);

	if (affected.length === 0) {
		return;
	}

	for (const agent of affected) {
		agents.set(agent.paneId, { ...agent, tabLabel: label });
	}

	return publish();
}

// O projeto que dá nome ao cartão: o agent foi aberto dentro da pasta dele. Com raízes aninhadas
// vence a mais funda, que é a que descreve onde o agent realmente está.
export function matchProjectByCwd<T extends { id: string; name: string; main_route: string }>(
	projects: T[],
	cwd: string,
): T | null {
	return (
		projects
			.filter((project) => cwd === project.main_route || cwd.startsWith(`${project.main_route}/`))
			.sort((left, right) => right.main_route.length - left.main_route.length)[0] ?? null
	);
}
