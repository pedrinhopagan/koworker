import { RPCHandler as WsRPCHandler } from "@orpc/server/bun-ws";
import { RPCHandler as FetchRPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, RequestHeadersPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";

import { DEFAULT_KOWORK_API_ORIGIN } from "@/lib/runtime-config";
import { router, wsRouter } from "./router";

export const rpcHandler = new FetchRPCHandler(router, {
	plugins: [
		new CORSPlugin({
			credentials: true,
			origin: (origin) => (origin ? origin : DEFAULT_KOWORK_API_ORIGIN),
		}),
		new RequestHeadersPlugin(),
		new ResponseHeadersPlugin(),
	],
});

export const wsRpcHandler = new WsRPCHandler(wsRouter);

export type API = typeof router;
export type WsAPI = typeof wsRouter;
