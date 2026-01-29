import { createORPCClient } from "@orpc/client";
import { RPCLink as FetchLink } from "@orpc/client/fetch";
import { RPCLink as WsLink } from "@orpc/client/websocket";
import type { InferRouterInputs, InferRouterOutputs, RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { API, WsAPI } from "./server";

const httpLink = new FetchLink({
	url: new URL("/rpc", window.location.origin).href,
	fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});

const wsUrl = new URL("/ws", window.location.origin);
wsUrl.protocol = wsUrl.protocol.replace("http", "ws");

const wsLink = new WsLink({
	websocket: new WebSocket(wsUrl),
});

const httpClient: RouterClient<API> = createORPCClient(httpLink);
const wsClient: RouterClient<WsAPI> = createORPCClient(wsLink);

export const orpc = createTanstackQueryUtils(httpClient);
export const orpcWs = createTanstackQueryUtils(wsClient);

export type RouterOutputs = InferRouterOutputs<API>;
export type RouterInputs = InferRouterInputs<API>;
export type WsRouterOutputs = InferRouterOutputs<WsAPI>;
export type WsRouterInputs = InferRouterInputs<WsAPI>;
