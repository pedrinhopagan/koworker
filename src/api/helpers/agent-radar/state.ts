import { realpathSync } from "node:fs";

import type { RadarAgent, RadarFocus } from "@/api/schemas/terminal-workspace";
import { PubSub } from "../../pubsub";
import { publishTerminalWorkspaceChange } from "../terminal-workspace-events";
import { scheduleAgentSnapshotCapture } from "./snapshot";

// Um agent aberto no kw-terminal, do jeito que a central mostra. É reflexo do daemon, que sobrevive
// ao restart do backend: nada disso é persistido, e a subida reconstrói o mapa relistando os panes.
// O que está na tela do cliente TUI agora. O trio chega junto do daemon (workspace → tab → pane);
// o koworker espelha isso no indicador "Na tela" sem precisar releitura do overview.
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

function publish(captureSnapshot: boolean) {
	const agents = listRadarAgents();
	if (captureSnapshot) {
		scheduleAgentSnapshotCapture(agents);
	}

	return Promise.all([
		PubSub.publish("agentRadar", "global", { agents, focus }),
		publishTerminalWorkspaceChange("agent"),
	]);
}

export function putRadarAgent(agent: RadarAgent) {
	agents.set(agent.paneId, agent);

	return publish(true);
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

	return publish(true);
}

export function resetRadarAgents(
	next: RadarAgent[],
	options: { focus?: RadarFocus; captureSnapshot: boolean },
) {
	agents.clear();
	for (const agent of next) {
		agents.set(agent.paneId, agent);
	}
	focus = options.focus ?? EMPTY_FOCUS;

	return publish(options.captureSnapshot);
}

export function setRadarFocus(next: RadarFocus) {
	if (sameFocus(focus, next)) {
		return;
	}

	focus = next;

	return publish(false);
}

export function removeRadarPane(paneId: string) {
	if (!agents.delete(paneId)) {
		return;
	}

	if (focus.paneId === paneId) {
		focus = { ...focus, paneId: null };
	}

	return publish(true);
}

export function removeRadarWorkspace(workspaceId: string) {
	const doomed = [...agents.values()].filter((agent) => agent.workspaceId === workspaceId);

	for (const agent of doomed) {
		agents.delete(agent.paneId);
	}

	if (focus.workspaceId === workspaceId) {
		focus = EMPTY_FOCUS;

		return publish(true);
	}

	if (doomed.length === 0) {
		return;
	}

	return publish(true);
}

export function renameRadarWorkspace(workspaceId: string, label: string) {
	const affected = [...agents.values()].filter((agent) => agent.workspaceId === workspaceId);

	if (affected.length === 0) {
		return;
	}

	for (const agent of affected) {
		agents.set(agent.paneId, { ...agent, workspaceLabel: label });
	}

	return publish(true);
}

export function renameRadarTab(tabId: string, label: string) {
	const affected = [...agents.values()].filter((agent) => agent.tabId === tabId);

	if (affected.length === 0) {
		return;
	}

	for (const agent of affected) {
		agents.set(agent.paneId, { ...agent, tabLabel: label });
	}

	return publish(true);
}

// O projeto que dá nome ao cartão: o agent foi aberto dentro da pasta dele. Com raízes aninhadas
// vence a mais funda, que é a que descreve onde o agent realmente está.
export function matchProjectByCwd<T extends { id: string; name: string; main_route: string }>(
	projects: T[],
	cwd: string,
): T | null {
	function canonicalPath(path: string) {
		try {
			return realpathSync(path);
		} catch {
			return path;
		}
	}

	const canonicalCwd = canonicalPath(cwd);
	const candidates = projects.map(function (project) {
		return { project, canonicalRoot: canonicalPath(project.main_route) };
	});

	return (
		candidates
			.filter(
				(candidate) =>
					canonicalCwd === candidate.canonicalRoot ||
					canonicalCwd.startsWith(`${candidate.canonicalRoot}/`),
			)
			.sort((left, right) => right.canonicalRoot.length - left.canonicalRoot.length)[0]?.project ??
		null
	);
}
