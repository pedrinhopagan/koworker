import type { ServerWebSocket } from "bun";

import { resolveSession, type User } from "./context";

const REVALIDATE_INTERVAL_MS = 60_000;
const SESSION_CLOSED_CODE = 4401;

export interface WsSessionData {
	user: User | null;
	cookieHeader: string | null;
}

const wsSessions = new Set<ServerWebSocket<WsSessionData>>();

let revalidateTimer: ReturnType<typeof setInterval> | null = null;

async function revalidateWsSession(ws: ServerWebSocket<WsSessionData>) {
	if (!ws.data.user) {
		return;
	}

	const session = await resolveSession(ws.data.cookieHeader);

	if (!session || session.user.id !== ws.data.user.id) {
		ws.close(SESSION_CLOSED_CODE, "Sessão expirada");

		return;
	}

	ws.data.user = session.user;
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
