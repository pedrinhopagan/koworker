import { dbAgentSessionSnapshots } from "../../db/agent-session-snapshots";
import type { RadarAgent } from "./state";

// O retrato é gravado com atraso: uma rajada de transições de status (o caso comum) vira uma escrita
// só, e o que fica no banco é sempre o estado mais recente.
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

	try {
		await dbAgentSessionSnapshots.replaceAll(
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
		);
	} catch (error) {
		console.error("[Radar] Falha ao gravar o retrato das sessões:", error);
	}
}

// Lista vazia nunca é gravada: o radar esvazia tanto quando o usuário fecha tudo quanto quando o
// daemon cai (ou a máquina desliga), e são os dois casos em que o retrato precisa sobreviver. O preço
// é que fechar todos os agents de propósito deixa o retrato de pé — quem não quer restaurar descarta.
export function scheduleRadarSnapshotCapture(agents: RadarAgent[]) {
	if (agents.length === 0) {
		return;
	}

	pending = agents;

	if (timer) {
		return;
	}

	timer = setTimeout(() => void flush(), CAPTURE_DEBOUNCE_MS);
	timer.unref?.();
}
