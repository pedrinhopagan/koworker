import { RPCLink } from "@orpc/client/fetch";

export const RPC_QUERY_TIMEOUT_MS = 30_000;

export function createHttpLink(url: string) {
	return new RPCLink({
		url,
		fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
		interceptors: [
			async ({ next, ...options }) => {
				if (!options.signal) {
					return await next(options);
				}

				const deadline = new AbortController();
				const timer = setTimeout(() => {
					deadline.abort(new DOMException("O servidor demorou para responder.", "TimeoutError"));
				}, RPC_QUERY_TIMEOUT_MS);

				try {
					return await next({
						...options,
						signal: AbortSignal.any([options.signal, deadline.signal]),
					});
				} finally {
					clearTimeout(timer);
				}
			},
		],
	});
}
