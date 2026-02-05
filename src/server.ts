import type { Server } from "bun";

import "./api/arktype";
import { rpcHandler, wsRpcHandler } from "./api/app";
import { getUser, type User } from "./api/auth/context";
import { DbUsers } from "./api/db/users";
import { PubSub, type TerminalEvent, type TerminalEventType } from "./api/pubsub";
import homepage from "./index.html";

const port = 3000;

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
					task_id: string;
					project_id: string;
					action?: "created" | "updated" | "deleted";
				};

				if (!body.task_id || !body.project_id) {
					return new Response("Bad Request", { status: 400 });
				}

				const event = {
					taskId: body.task_id,
					projectId: body.project_id,
					action: body.action ?? "updated",
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
		"/*": homepage,
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
