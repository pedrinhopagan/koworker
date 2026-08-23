import { stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Server } from "bun";
import type { z } from "zod";

import "./api/arktype";
import { isAllowedOrigin, rpcHandler, wsRpcHandler } from "./api/app";
import { resolveSessionDevice } from "./api/auth/context";
import { registerWsSession, unregisterWsSession, type WsSessionData } from "./api/auth/ws-sessions";
import { envVariables } from "./api/config/env";
import { dbProjects } from "./api/db/projects";
import { DbUsers } from "./api/db/users";
import { isNotifyAuthorized } from "./api/helpers/notify-auth";
import { resolveProjectLogo } from "./api/helpers/project-logo";
import { PubSub } from "./api/pubsub";
import { TaskNotifySchema } from "./api/schemas";
import { KwTerminalNavigateSchema } from "./api/schemas/kw-terminal";
import homepage from "./index.html";
import { staticCacheHeader } from "./lib/static-cache";
import { DEFAULT_KOWORK_PORT } from "./lib/runtime-config";

const isProduction = envVariables.NODE_ENV === "production";
// hot-deploy grava KOWORK_DIST_DIR no ambiente; string vazia já vira undefined em env.ts
const distDir = isProduction ? (envVariables.KOWORK_DIST_DIR ?? "./dist") : null;

const NOTIFY_MAX_BODY_BYTES = 8192;

async function serveStatic(pathname: string) {
	if (!distDir) return null;

	const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
	const distRoot = resolve(distDir);
	const resolvedPath = resolve(distRoot, cleanPath);
	const relativePath = relative(distRoot, resolvedPath);

	if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
		return null;
	}

	// Sem Cache-Control o navegador usa cache heurístico e abre com assets velhos depois do deploy —
	// a causa principal de o celular carregar versão antiga fora do fluxo do botão.
	const headers: Record<string, string> = {};
	const cacheControl = staticCacheHeader(pathname);
	if (cacheControl) {
		headers["Cache-Control"] = cacheControl;
	}

	try {
		const stats = await stat(resolvedPath);
		if (stats.isFile()) {
			return new Response(Bun.file(resolvedPath), { headers });
		}
	} catch {
		// path não existe — cai no fallback SPA abaixo
	}

	const indexPath = join(distRoot, "index.html");
	try {
		const indexStats = await stat(indexPath);
		if (indexStats.isFile()) {
			return new Response(Bun.file(indexPath), {
				headers: { "Content-Type": "text/html", ...headers },
			});
		}
	} catch {
		return null;
	}

	return null;
}

// Porta de entrada das rotas HTTP que ferramentas locais chamam sem sessão:
// só POST, só loopback (ou token), corpo limitado e validado pelo schema dono.
async function readLoopbackBody<T>(
	request: Request,
	server: Server<WsSessionData>,
	schema: z.ZodType<T>,
): Promise<{ data: T } | { response: Response }> {
	if (request.method !== "POST") {
		return { response: new Response("Method Not Allowed", { status: 405 }) };
	}

	const authorized = isNotifyAuthorized({
		headers: request.headers,
		remoteAddress: server.requestIP(request)?.address,
		notifyToken: envVariables.KOWORK_NOTIFY_TOKEN,
	});
	if (!authorized) {
		return { response: new Response("Unauthorized", { status: 401 }) };
	}

	if (Number(request.headers.get("content-length") ?? 0) > NOTIFY_MAX_BODY_BYTES) {
		return { response: new Response("Payload Too Large", { status: 413 }) };
	}

	let rawBody: string;
	try {
		rawBody = await request.text();
	} catch {
		return { response: new Response("Bad Request", { status: 400 }) };
	}

	if (rawBody.length > NOTIFY_MAX_BODY_BYTES) {
		return { response: new Response("Payload Too Large", { status: 413 }) };
	}

	let payload: unknown;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return { response: new Response("Bad Request", { status: 400 }) };
	}

	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		return { response: new Response("Bad Request", { status: 400 }) };
	}

	return { data: parsed.data };
}

async function serveProjectLogo(request: Request, server: Server<WsSessionData>) {
	const session = await resolveSessionDevice({
		cookieHeader: request.headers.get("cookie"),
		userAgent: request.headers.get("user-agent") ?? undefined,
		remoteAddress: server.requestIP(request)?.address,
	});
	if (!session || session.device.status !== "approved") {
		return new Response("Unauthorized", { status: 401 });
	}

	const projectId = new URL(request.url).pathname.replace("/api/project-logos/", "");
	if (!projectId || projectId.includes("/")) {
		return new Response("Bad Request", { status: 400 });
	}

	const project = await dbProjects.getById(projectId);
	if (!project) {
		return new Response("Not Found", { status: 404 });
	}

	const logoPath = await resolveProjectLogo(project.main_route);
	if (!logoPath) {
		return new Response("Not Found", { status: 404 });
	}

	return new Response(Bun.file(logoPath), {
		headers: {
			"Cache-Control": "private, max-age=300",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

const port = Number(envVariables.KOWORK_PORT) || DEFAULT_KOWORK_PORT;

await DbUsers.ensureDefaultUser();

// Keep local DB schema compatible with current code (idempotent).
const { ensureDbSchema } = await import("./api/db/migrate");
ensureDbSchema();

// Semeia settings de SO e roots default de agents/skills por plataforma (primeira execução).
const { ensureDefaultSettings, ensureDefaultCategories, migrateTerminalMultiplexerRename } =
	await import("./api/db/seed-defaults");
await migrateTerminalMultiplexerRename();
await ensureDefaultSettings();
await ensureDefaultCategories();

const { purgeOrphanStorageLocks } = await import("./api/helpers/task-storage-coordinator");
await purgeOrphanStorageLocks().catch((error) => {
	console.error("Falha ao limpar locks órfãos de storage:", error);
});

// Observa as pastas `.koworker/` dos projetos pra refletir edições do agente na UI.
const { startTasksWatcher } = await import("./api/helpers/tasks-watcher");
await startTasksWatcher();

// Fecha execuções que perderam o executor e vigia o teto de tempo dos runs em andamento.
const { startRunReconciler } = await import("./api/helpers/prompt-run");
const { abortActiveRuns } = await import("./api/helpers/run-registry");
await startRunReconciler();

// Sessões vivas pertencem ao processo que as criou: as que sobraram de um executor morto viram
// `crashed` no boot, com o botão de retomar na rota.
// Central de agents: escuta o socket do kw-terminal e mantém em memória o estado de quem está
// trabalhando, travado ou pronto. Falhar aqui não derruba o servidor — o watcher reconecta sozinho.
const { startAgentRadar, stopAgentRadar } = await import("./api/helpers/agent-radar/watcher");
await startAgentRadar().catch((error) => {
	console.error("Falha ao iniciar a central de agents:", error);
});

let shuttingDown = false;

async function shutdown(signal: string) {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;

	const aborted = await abortActiveRuns();
	if (aborted > 0) {
		console.log(`[${signal}] ${aborted} execução(ões) encerrada(s) junto com o servidor`);
	}

	await stopAgentRadar();

	process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

Bun.serve<WsSessionData>({
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
		"/healthz": () => Response.json({ ok: true }),
		"/rpc/*": async (request: Request, server: Server<WsSessionData>) => {
			const { response } = await rpcHandler.handle(request, {
				prefix: "/rpc",
				context: { remoteAddress: server.requestIP(request)?.address ?? null },
			});

			return response ?? new Response("Not Found", { status: 404 });
		},
		"/api/project-logos/*": serveProjectLogo,
		"/api/tasks/notify": async (request: Request, server: Server<WsSessionData>) => {
			const body = await readLoopbackBody(request, server, TaskNotifySchema);
			if ("response" in body) {
				return body.response;
			}

			const event = { ...body.data, source: "cli" as const };
			await PubSub.publish("tasks", body.data.projectId, event);
			await PubSub.publish("tasks", "global", event);

			return Response.json({ ok: true });
		},
		// Canal MCP da sessão: o CLI do agente, rodando nesta máquina, chama a ferramenta de perguntar
		// ao usuário. Só loopback — a porta é pública na VPS e o id da sessão não é credencial.
		"/api/kw-terminal/navigate": async (request: Request, server: Server<WsSessionData>) => {
			const body = await readLoopbackBody(request, server, KwTerminalNavigateSchema);
			if ("response" in body) {
				return body.response;
			}

			await PubSub.publish("navigate", "global", body.data);

			return Response.json({ ok: true });
		},
		"/ws": async (request: Request, server: Server<WsSessionData>) => {
			if (!isAllowedOrigin(request.headers.get("origin"))) {
				return new Response("Forbidden", { status: 403 });
			}

			const cookieHeader = request.headers.get("cookie");
			const remoteAddress = server.requestIP(request)?.address ?? null;
			const session = await resolveSessionDevice({
				cookieHeader,
				userAgent: request.headers.get("user-agent") ?? undefined,
				remoteAddress,
			});

			// Socket é canal de dado vivo: dispositivo pendente ou bloqueado não sobe, mesmo com
			// sessão válida no cookie.
			if (session && session.device.status !== "approved") {
				return new Response("Forbidden", { status: 403 });
			}

			const upgraded = server.upgrade(request, {
				data: {
					user: session?.user ?? null,
					device: session?.device ?? null,
					cookieHeader,
					remoteAddress,
				},
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
		open(ws) {
			registerWsSession(ws);
		},
		message(ws, message) {
			wsRpcHandler.message(ws, message, {
				context: { user: ws.data?.user ?? null, device: ws.data?.device ?? null },
			});
		},
		close(ws) {
			unregisterWsSession(ws);
			wsRpcHandler.close(ws);
		},
	},
});

console.log(`Servidor rodando em http://localhost:${port}`);

export type { API, WsAPI } from "./api/app";
