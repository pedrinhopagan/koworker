import type { AgentRadarStatus } from "@/constants/agent-radar";
import { PubSub } from "../../pubsub";
import { scheduleRadarSnapshotCapture } from "./snapshot";

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

// O que está na tela do cliente TUI agora. O trio chega junto do daemon (workspace → tab → pane);
// o koworker espelha isso no indicador "Na tela" sem precisar releitura do overview.
export type RadarFocus = {
	workspaceId: string | null;
	tabId: string | null;
	paneId: string | null;
};

const EMPTY_FOCUS: RadarFocus = { workspaceId: null, tabId: null, paneId: null };

const agents = new Map<string, RadarAgent>();
let focus: RadarFocus = EMPTY_FOCUS;

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

export function getRadarFocus(): RadarFocus {
	return focus;
}

function sameFocus(left: RadarFocus, right: RadarFocus) {
	return (
		left.workspaceId === right.workspaceId &&
		left.tabId === right.tabId &&
		left.paneId === right.paneId
	);
}

function publish() {
	const agents = listRadarAgents();
	scheduleRadarSnapshotCapture(agents);

	return PubSub.publish("agentRadar", "global", { agents, focus });
}

export function putRadarAgent(agent: RadarAgent) {
	agents.set(agent.paneId, agent);

	return publish();
}

export function setRadarAgentSession(
	paneId: string,
	session: Pick<RadarAgent, "sessionId" | "sessionPath">,
) {
	const agent = agents.get(paneId);
	if (
		!agent ||
		(agent.sessionId === session.sessionId && agent.sessionPath === session.sessionPath)
	) {
		return;
	}

	agents.set(paneId, { ...agent, ...session });

	return publish();
}

export function resetRadarAgents(next: RadarAgent[], nextFocus: RadarFocus = EMPTY_FOCUS) {
	agents.clear();
	for (const agent of next) {
		agents.set(agent.paneId, agent);
	}
	focus = nextFocus;

	return publish();
}

export function setRadarFocus(next: RadarFocus) {
	if (sameFocus(focus, next)) {
		return;
	}

	focus = next;

	return publish();
}

export function removeRadarPane(paneId: string) {
	if (!agents.delete(paneId)) {
		return;
	}

	if (focus.paneId === paneId) {
		focus = { ...focus, paneId: null };
	}

	return publish();
}

export function removeRadarWorkspace(workspaceId: string) {
	const doomed = [...agents.values()].filter((agent) => agent.workspaceId === workspaceId);

	for (const agent of doomed) {
		agents.delete(agent.paneId);
	}

	if (focus.workspaceId === workspaceId) {
		focus = EMPTY_FOCUS;

		return publish();
	}

	if (doomed.length === 0) {
		return;
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
