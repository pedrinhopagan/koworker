import { createORPCClient } from "@orpc/client";
import { RPCLink as FetchLink } from "@orpc/client/fetch";
import { RPCLink as WsLink } from "@orpc/client/websocket";
import type { InferRouterInputs, InferRouterOutputs, RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { isTauri } from "@/lib/tauri";
import type { API, WsAPI } from "./server";

declare global {
	interface Window {
		__KOWORK_API_URL__?: string;
	}
}

const apiOrigin = (() => {
	if (typeof window === "undefined") {
		return "http://localhost:3000";
	}

	if (window.__KOWORK_API_URL__) {
		return window.__KOWORK_API_URL__;
	}

	if (isTauri()) {
		return "http://localhost:3000";
	}

	return window.location.origin;
})();

const httpLink = new FetchLink({
	url: new URL("/rpc", apiOrigin).href,
	fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});

const wsBase = new URL(apiOrigin);
wsBase.protocol = wsBase.protocol.replace("http", "ws");

const wsLink = new WsLink({
	websocket: new WebSocket(new URL("/ws", wsBase).href),
});

const httpClient: RouterClient<API> = createORPCClient(httpLink);
const wsClient: RouterClient<WsAPI> = createORPCClient(wsLink);

export const orpc = createTanstackQueryUtils(httpClient);
export const orpcWs = createTanstackQueryUtils(wsClient);

export type RouterOutputs = InferRouterOutputs<API>;
export type RouterInputs = InferRouterInputs<API>;
export type WsRouterOutputs = InferRouterOutputs<WsAPI>;
export type WsRouterInputs = InferRouterInputs<WsAPI>;
