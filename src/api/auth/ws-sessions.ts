import type { ServerWebSocket } from "bun";

import type { Device, User } from "./context";
import { resolveSessionDevice } from "./context";

const REVALIDATE_INTERVAL_MS = 60_000;
const SESSION_CLOSED_CODE = 4401;

export interface WsSessionData {
	user: User | null;
	device: Device | null;
	cookieHeader: string | null;
	remoteAddress: string | null;
}

const wsSessions = new Set<ServerWebSocket<WsSessionData>>();

let revalidateTimer: ReturnType<typeof setInterval> | null = null;

async function revalidateWsSession(ws: ServerWebSocket<WsSessionData>) {
	if (!ws.data.user) {
		return;
	}

	const session = await resolveSessionDevice({
		cookieHeader: ws.data.cookieHeader,
		userAgent: undefined,
		remoteAddress: ws.data.remoteAddress,
	});

	if (!session || session.user.id !== ws.data.user.id || session.device.status !== "approved") {
		ws.close(SESSION_CLOSED_CODE, "Sessão expirada");

		return;
	}

	ws.data.user = session.user;
	ws.data.device = session.device;
}

async function revalidateWsSessions() {
	for (const ws of wsSessions) {
		await revalidateWsSession(ws).catch((error) => {
			console.error("[WsSessions] Falha ao revalidar a sessão do socket:", error);
		});
	}
}

export function registerWsSession(ws: ServerWebSocket<WsSessionData>) {
	wsSessions.add(ws);

	if (revalidateTimer) {
		return;
	}

	revalidateTimer = setInterval(revalidateWsSessions, REVALIDATE_INTERVAL_MS);
}

export function unregisterWsSession(ws: ServerWebSocket<WsSessionData>) {
	wsSessions.delete(ws);

	if (wsSessions.size > 0 || !revalidateTimer) {
		return;
	}

	clearInterval(revalidateTimer);
	revalidateTimer = null;
}

export function closeWsSessionsForUser(userId: number) {
	for (const ws of wsSessions) {
		if (ws.data.user?.id === userId) {
			ws.close(SESSION_CLOSED_CODE, "Sessão encerrada");
		}
	}
}

export function closeWsSessionsForDevice(deviceId: string) {
	for (const ws of wsSessions) {
		if (ws.data.device?.id === deviceId) {
			ws.close(SESSION_CLOSED_CODE, "Dispositivo revogado");
		}
	}
}
