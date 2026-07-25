import { dbExecutionRuns } from "../db/execution-runs";

const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_STALE_MS = 3 * HEARTBEAT_INTERVAL_MS;

const activeRuns = new Map<string, AbortController>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function trackRun(runId: string) {
	const controller = new AbortController();
	activeRuns.set(runId, controller);
	if (heartbeatTimer) {
		return controller;
	}

	heartbeatTimer = setInterval(() => {
		const ids = [...activeRuns.keys()];
		if (ids.length === 0 && heartbeatTimer) {
			clearInterval(heartbeatTimer);
			heartbeatTimer = null;
			return;
		}

		void dbExecutionRuns.touchHeartbeat(ids).catch((error) => {
			console.error("[Runs] Falha ao registrar o sinal de vida da execução:", error);
		});
	}, HEARTBEAT_INTERVAL_MS);
	heartbeatTimer.unref();

	return controller;
}

export function getActiveRun(runId: string) {
	return activeRuns.get(runId);
}

export function releaseRun(runId: string) {
	activeRuns.delete(runId);
}

export async function abortActiveRuns(timeoutMs = 5_000) {
	const total = activeRuns.size;
	if (total === 0) {
		return 0;
	}

	for (const controller of activeRuns.values()) {
		controller.abort();
	}

	const deadline = Date.now() + timeoutMs;
	while (activeRuns.size > 0 && Date.now() < deadline) {
		await Bun.sleep(50);
	}

	return total;
}
