import { isAbsolute, join, relative, resolve } from "node:path";
import type { Server } from "bun";

import "./api/arktype";
import { rpcHandler, wsRpcHandler } from "./api/app";
import { getUser, type User } from "./api/auth/context";
import { envVariables } from "./api/config/env";
import { DbUsers } from "./api/db/users";
import { PubSub } from "./api/pubsub";
import homepage from "./index.html";
import { DEFAULT_KOWORK_PORT } from "./lib/runtime-config";

const isProduction = envVariables.NODE_ENV === "production";
const distDir = envVariables.KOWORK_DIST_DIR ?? (isProduction ? "./dist" : null);

const NOTIFY_MAX_BODY_BYTES = 8192;

function isLocalRequest(request: Request, server: Server<WsData>): boolean {
	const ip = server.requestIP(request);
	if (ip?.address === "127.0.0.1" || ip?.address === "::1") {
		return true;
	}

	const host = request.headers.get("host");
	if (!host) {
		return false;
	}

	return host.startsWith("localhost:") || host === "localhost" || host.startsWith("127.0.0.1:");
}

function isNotifyAuthorized(request: Request, server: Server<WsData>): boolean {
	const notifyToken = envVariables.KOWORK_NOTIFY_TOKEN;
	if (notifyToken) {
		const authHeader = request.headers.get("authorization");
		const customToken = request.headers.get("x-kowork-token");
		const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
		const token = bearerToken ?? customToken;
		return token === notifyToken;
	}

	return isLocalRequest(request, server);
}

async function serveStatic(pathname: string) {
	if (!distDir) return null;

	const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
	const distRoot = resolve(distDir);
	const resolvedPath = resolve(distRoot, cleanPath);
	const relativePath = relative(distRoot, resolvedPath);

	if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
		return null;
	}

	const filePath = Bun.file(resolvedPath);
	const exists = await filePath.exists();

	if (!exists && pathname !== "/") {
		const indexPath = Bun.file(join(distRoot, "index.html"));
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
const { ensureDefaultSettings, ensureDefaultCategories } = await import("./api/db/seed-defaults");
await ensureDefaultSettings();
await ensureDefaultCategories();

// Observa as pastas `.koworker/` dos projetos pra refletir edições do agente na UI.
const { startTasksWatcher } = await import("./api/helpers/tasks-watcher");
await startTasksWatcher();

Bun.serve<WsData>({
	port,
	...(isProduction
		? {}
		: {
				development: {
					hmr: true,
					console: true,
				},
			}),
	routes: {
		"/rpc/*": async (request: Request) => {
			const { response } = await rpcHandler.handle(request, {
				prefix: "/rpc",
				context: {},
			});

			return response ?? new Response("Not Found", { status: 404 });
		},
		"/api/tasks/notify": async (request: Request, server: Server<WsData>) => {
			if (request.method !== "POST") {
				return new Response("Method Not Allowed", { status: 405 });
			}

			if (!isNotifyAuthorized(request, server)) {
				return new Response("Unauthorized", { status: 401 });
			}

			const contentLength = Number(request.headers.get("content-length") ?? 0);
			if (contentLength > NOTIFY_MAX_BODY_BYTES) {
				return new Response("Payload Too Large", { status: 413 });
			}

			let rawBody: string;
			try {
				rawBody = await request.text();
			} catch {
				return new Response("Bad Request", { status: 400 });
			}

			if (rawBody.length > NOTIFY_MAX_BODY_BYTES) {
				return new Response("Payload Too Large", { status: 413 });
			}

			try {
				const body = JSON.parse(rawBody) as {
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
