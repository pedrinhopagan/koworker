import { dbAgentSessionSnapshots } from "../../db/agent-session-snapshots";
import type { RadarAgent } from "@/api/schemas/terminal-workspace";

const CAPTURE_DEBOUNCE_MS = 2_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: RadarAgent[] | null = null;

async function flush() {
	const agents = pending;
	timer = null;
	pending = null;

	if (!agents) {
		return;
	}

	await dbAgentSessionSnapshots
		.replaceAll(
			agents.map((agent) => ({
				paneId: agent.paneId,
				workspaceLabel: agent.workspaceLabel,
				tabLabel: agent.tabLabel,
				agent: agent.agent,
				cwd: agent.cwd,
				projectId: agent.projectId,
				projectName: agent.projectName,
				status: agent.status,
				sessionId: agent.sessionId,
				sessionPath: agent.sessionPath,
				title: agent.title,
				taskId: agent.taskId,
				taskTitle: agent.taskTitle,
			})),
		)
		.catch((error) => {
			console.error("[Radar] Falha ao gravar terminais abertos:", error);
		});
}

export function scheduleAgentSnapshotCapture(agents: RadarAgent[]) {
	pending = agents;

	if (timer) {
		return;
	}

	timer = setTimeout(() => void flush(), CAPTURE_DEBOUNCE_MS);
	timer.unref?.();
}
