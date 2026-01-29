import { RPCHandler as WsRPCHandler } from "@orpc/server/bun-ws";
import { RPCHandler as FetchRPCHandler } from "@orpc/server/fetch";
import { RequestHeadersPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";

import { router, wsRouter } from "./router";

export const rpcHandler = new FetchRPCHandler(router, {
	plugins: [new RequestHeadersPlugin(), new ResponseHeadersPlugin()],
});

export const wsRpcHandler = new WsRPCHandler(wsRouter);

export type API = typeof router;
export type WsAPI = typeof wsRouter;
