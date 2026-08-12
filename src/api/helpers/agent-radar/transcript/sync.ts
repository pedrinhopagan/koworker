import {
	kwTerminalPaneGet,
	kwTerminalPaneProcessInfo,
	kwTerminalPaneSession,
} from "../../terminal/kw-terminal";
import { getRadarAgent, putRadarAgent, type RadarAgent } from "../state";
import { resolveProcessTranscript } from "./process";

// O arquivo de sessão não é estável enquanto o pane vive: um `/clear` no claude (ou um `codex`
// recomeçado no mesmo shell) abre outra sessão sem trocar de processo, e o daemon segue anunciando o
// caminho que viu na detecção. Reperguntar ao processo é o que faz a conversa do app trocar junto.
export async function syncPaneTranscriptSource(paneId: string) {
	const agent = getRadarAgent(paneId);
	if (!agent) {
		return null;
	}

	const pane = await kwTerminalPaneGet(paneId).catch(() => null);
	const reported = pane
		? kwTerminalPaneSession(pane)
		: { sessionId: agent.sessionId, sessionPath: agent.sessionPath };
	const processInfo = await kwTerminalPaneProcessInfo(paneId).catch(() => null);
	const transcript = processInfo
		? await resolveProcessTranscript({
				agent: agent.agent,
				processIds: processInfo.foreground_processes.map((process) => process.pid),
			})
		: null;

	const session = transcript
		? { sessionId: transcript.sessionId, sessionPath: transcript.path }
		: reported;
	if (session.sessionId === agent.sessionId && session.sessionPath === agent.sessionPath) {
		return transcript;
	}

	const current: RadarAgent | null = getRadarAgent(paneId);
	if (!current) {
		return null;
	}

	await putRadarAgent({
		...current,
		...session,
	});

	return transcript;
}
