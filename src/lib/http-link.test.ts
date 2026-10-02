import { expect, test } from "bun:test";
import { type Client, createORPCClient } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { createHttpLink, RPC_QUERY_TIMEOUT_MS } from "./http-link";

test(
	"consulta sem resposta termina com erro e pode ser refeita sem reiniciar",
	async () => {
		let stalled = true;
		const server = Bun.serve({
			port: 0,
			idleTimeout: 0,
			fetch() {
				if (stalled) {
					return new Response(
						new ReadableStream({
							start(controller) {
								controller.enqueue(new TextEncoder().encode('{"json":'));
							},
						}),
						{ headers: { "content-type": "application/json" } },
					);
				}

				return Response.json({ json: ["tarefa"] });
			},
		});
		const client = createORPCClient<{
			tasks: Client<Record<never, never>, undefined, string[], Error>;
		}>(createHttpLink(`http://localhost:${server.port}/rpc`));
		const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const options = {
			queryKey: ["tasks"],
			queryFn: ({ signal }: { signal: AbortSignal }) => client.tasks(undefined, { signal }),
		};

		try {
			await expect(queries.fetchQuery(options)).rejects.toThrow();
			expect(queries.getQueryState(options.queryKey)?.status).toBe("error");
			expect(queries.getQueryState(options.queryKey)?.fetchStatus).toBe("idle");
			stalled = false;
			const recovered = await queries.fetchQuery(options);
			expect(recovered).toEqual(["tarefa"]);
		} finally {
			queries.clear();
			server.stop(true);
		}
	},
	RPC_QUERY_TIMEOUT_MS + 5_000,
);

test("preserva o cancelamento de uma consulta", async () => {
	const server = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
	const link = createHttpLink(`http://localhost:${server.port}/rpc`);
	const controller = new AbortController();
	const pending = link.call(["tasks"], undefined, { signal: controller.signal, context: {} });
	controller.abort();

	try {
		await expect(pending).rejects.toThrow();
	} finally {
		server.stop(true);
	}
});
