import { expect, test } from "bun:test";

import { createResilientWebSocket } from "./resilient-websocket";

const received: string[] = [];
let opened = 0;

function serve(port: number | undefined) {
	return Bun.serve({
		port,
		fetch: (request, server) => (server.upgrade(request) ? undefined : new Response("no")),
		websocket: {
			open: () => {
				opened += 1;
			},
			message: (ws, message) => {
				received.push(String(message));
				ws.send("eco");
			},
		},
	});
}

async function waitFor(check: () => boolean, timeoutMs = 10_000) {
	const deadline = Date.now() + timeoutMs;
	while (!check() && Date.now() < deadline) {
		await Bun.sleep(25);
	}

	return check();
}

test("reconecta e entrega o que foi enviado enquanto estava fora do ar", async () => {
	const server = serve(0);
	const port = server.port;
	const socket = createResilientWebSocket(`ws://localhost:${port}/ws`);
	const echoes: string[] = [];
	socket.addEventListener("message", (event) => {
		echoes.push(String((event as MessageEvent).data));
	});

	expect(await waitFor(() => opened === 1)).toBe(true);
	socket.send("antes");
	expect(await waitFor(() => received.includes("antes"))).toBe(true);
	expect(await waitFor(() => echoes.includes("eco"))).toBe(true);

	server.stop(true);
	expect(await waitFor(() => socket.readyState !== WebSocket.OPEN)).toBe(true);

	socket.send("durante a queda");
	const revived = serve(port);
	const recovered = await waitFor(() => opened > 1 && received.includes("durante a queda"));
	revived.stop(true);

	expect(recovered).toBe(true);
}, 30_000);
