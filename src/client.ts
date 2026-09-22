import { createORPCClient } from "@orpc/client";
import { RPCLink as WsLink } from "@orpc/client/websocket";
import type { InferRouterInputs, InferRouterOutputs, RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { getAppEnv } from "@/lib/env";
import { createResilientWebSocket } from "@/lib/resilient-websocket";
import { DEFAULT_KOWORK_API_ORIGIN, resolveApiOrigin } from "@/lib/runtime-config";
import { isDesktop } from "@/lib/desktop";
import { createHttpLink } from "@/lib/http-link";
import type { API, WsAPI } from "./server";

const apiOrigin = (() => {
	if (typeof window === "undefined") {
		return DEFAULT_KOWORK_API_ORIGIN;
	}

	return resolveApiOrigin({
		windowOrigin: window.location.origin,
		isDesktopEnvironment: isDesktop(),
		appEnv: getAppEnv(),
	});
})();

const httpLink = createHttpLink(new URL("/rpc", apiOrigin).href);

const wsBase = new URL(apiOrigin);
wsBase.protocol = wsBase.protocol.replace("http", "ws");

const realtimeSocket = createResilientWebSocket(new URL("/ws", wsBase).href);

const wsLink = new WsLink({ websocket: realtimeSocket });

export function reconnectRealtime() {
	realtimeSocket.forceReconnect();
}

const httpClient: RouterClient<API> = createORPCClient(httpLink);
const wsClient: RouterClient<WsAPI> = createORPCClient(wsLink);

export const orpc = createTanstackQueryUtils(httpClient);
export const orpcWs = createTanstackQueryUtils(wsClient);

export type RouterOutputs = InferRouterOutputs<API>;
export type RouterInputs = InferRouterInputs<API>;
export type WsRouterOutputs = InferRouterOutputs<WsAPI>;
export type WsRouterInputs = InferRouterInputs<WsAPI>;
