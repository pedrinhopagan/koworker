import { join } from "node:path";
import type { Server } from "bun";

import "./api/arktype";
import { rpcHandler, wsRpcHandler } from "./api/app";
import { getUser, type User } from "./api/auth/context";
import { envVariables } from "./api/config/env";
import { DbUsers } from "./api/db/users";
import { PubSub, type TerminalEvent, type TerminalEventType } from "./api/pubsub";
import homepage from "./index.html";
import { DEFAULT_KOWORK_PORT } from "./lib/runtime-config";

const isProduction = envVariables.NODE_ENV === "production";
const distDir = envVariables.KOWORK_DIST_DIR ?? (isProduction ? "./dist" : null);

async function serveStatic(pathname: string) {
	if (!distDir) return null;

	const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
	const filePath = Bun.file(join(distDir, cleanPath));
	const exists = await filePath.exists();

	if (!exists && pathname !== "/") {
		const indexPath = Bun.file(join(distDir, "index.html"));
		const indexExists = await indexPath.exists();
		if (indexExists) {
			return new Response(indexPath, {
				headers: { "Content-Type": "text/html" },
			});
		}
		return null;
	}

	return new Response(filePath);
}

const port = Number(envVariables.KOWORK_PORT) || DEFAULT_KOWORK_PORT;

interface WsData {
	user: User | null;
}

function getCookieValue(cookieHeader: string | null, name: string) {
	if (!cookieHeader) return;

	return cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1];
}

await DbUsers.ensureDefaultUser();

// Keep local DB schema compatible with current code (idempotent).
const { ensureDbSchema } = await import("./api/db/migrate");
ensureDbSchema();

// Semeia settings de SO e roots default de agents/skills por plataforma (primeira execução).
const { ensureDefaultSettings } = await import("./api/db/seed-defaults");
await ensureDefaultSettings();

// Observa as pastas `.koworker/` dos projetos pra refletir edições do agente na UI.
const { startTasksWatcher } = await import("./api/helpers/tasks-watcher");
await startTasksWatcher();

Bun.serve<WsData>({
	port,
	development: {
		hmr: true,
		console: true,
	},
	routes: {
		"/rpc/*": async (request: Request) => {
			const { response } = await rpcHandler.handle(request, {
				prefix: "/rpc",
				context: {},
			});

			return response ?? new Response("Not Found", { status: 404 });
		},
		"/api/tasks/notify": async (request: Request) => {
			if (request.method !== "POST") {
				return new Response("Method Not Allowed", { status: 405 });
			}

			try {
				const body = (await request.json()) as {
					project_id: string;
					task_id?: string;
					action: "created" | "updated" | "deleted";
				};

				// A CLI escreve direto no banco (outro processo) e avisa por aqui. O cliente só
				// assina o canal `tasks` global, então publica nos dois (per-projeto + global),
				// igual ao publishTaskEvent do router.
				const event = {
					taskId: body.task_id,
					projectId: body.project_id,
					action: body.action,
					source: "cli" as const,
				};
				await PubSub.publish("tasks", body.project_id, event);
				await PubSub.publish("tasks", "global", event);

				return Response.json({ ok: true });
			} catch {
				return new Response("Bad Request", { status: 400 });
			}
		},
		"/api/terminal/notify": async (request: Request) => {
			if (request.method !== "POST") {
				return new Response("Method Not Allowed", { status: 405 });
			}

			try {
				const body = (await request.json()) as {
					event_type: string;
					project_id: string;
					task_id?: string;
					session_name: string;
					window_name?: string;
				};

				const event: TerminalEvent = {
					eventType: body.event_type as TerminalEventType,
					projectId: body.project_id,
					taskId: body.task_id,
					sessionName: body.session_name,
					windowName: body.window_name,
				};

				await PubSub.terminal.publish(event);

				return Response.json({ ok: true });
			} catch {
				return new Response("Bad Request", { status: 400 });
			}
		},
		"/ws": async (request: Request, server: Server<WsData>) => {
			const cookieHeader = request.headers.get("cookie");
			const token = getCookieValue(cookieHeader, "session");
			const user = await getUser(token);

			const upgraded = server.upgrade(request, {
				data: { user: user ?? null },
			});

			if (!upgraded) {
				return new Response("WebSocket upgrade failed", { status: 500 });
			}
		},
		"/*": distDir
			? async (request: Request) => {
					const url = new URL(request.url);
					const staticResponse = await serveStatic(url.pathname);
					if (staticResponse) return staticResponse;
					return new Response("Not Found", { status: 404 });
				}
			: homepage,
	},
	websocket: {
		message(ws, message) {
			wsRpcHandler.message(ws, message, {
				context: { user: ws.data?.user ?? null },
			});
		},
		close(ws) {
			wsRpcHandler.close(ws);
		},
	},
});

console.log(`Servidor rodando em http://localhost:${port}`);

export type { API, WsAPI } from "./api/app";
