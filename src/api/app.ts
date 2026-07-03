import { RPCHandler as WsRPCHandler } from "@orpc/server/bun-ws";
import { RPCHandler as FetchRPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, RequestHeadersPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";

import { DEFAULT_KOWORK_API_ORIGIN } from "@/lib/runtime-config";
import { envVariables } from "./config/env";
import { router, wsRouter } from "./router";

function buildAllowedOrigins(): Set<string> {
	const origins = new Set([
		"https://kw.paganagency.dedyn.io",
		"http://localhost:1420",
		"http://localhost:3000",
		DEFAULT_KOWORK_API_ORIGIN,
	]);

	const extra = envVariables.KOWORK_ALLOWED_ORIGINS;
	if (extra) {
		for (const item of extra.split(",")) {
			const trimmed = item.trim();
			if (trimmed) {
				origins.add(trimmed);
			}
		}
	}

	return origins;
}

const allowedOrigins = buildAllowedOrigins();

function resolveCorsOrigin(origin: string | undefined): string {
	if (!origin) {
		return DEFAULT_KOWORK_API_ORIGIN;
	}
	if (allowedOrigins.has(origin)) {
		return origin;
	}
	return DEFAULT_KOWORK_API_ORIGIN;
}

export const rpcHandler = new FetchRPCHandler(router, {
	plugins: [
		new CORSPlugin({
			credentials: true,
			origin: resolveCorsOrigin,
		}),
		new RequestHeadersPlugin(),
		new ResponseHeadersPlugin(),
	],
});

export const wsRpcHandler = new WsRPCHandler(wsRouter);

export type API = typeof router;
export type WsAPI = typeof wsRouter;
