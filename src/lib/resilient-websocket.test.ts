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

test("offline invalida socket aberto, online conecta de novo e close antigo não derruba o novo", async () => {
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
	const browser = new EventTarget();
	const network = { onLine: true };
	Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
	Object.defineProperty(globalThis, "navigator", { configurable: true, value: network });
	const server = serve(0);
	const socket = createResilientWebSocket(`ws://localhost:${server.port}/ws`);
	let closes = 0;
	socket.addEventListener("close", () => {
		closes += 1;
	});
	try {
		expect(await waitFor(() => socket.readyState === WebSocket.OPEN)).toBe(true);
		network.onLine = false;
		browser.dispatchEvent(new Event("offline"));
		expect(socket.readyState).toBe(WebSocket.CLOSED);
		expect(closes).toBe(1);
		network.onLine = true;
		browser.dispatchEvent(new Event("online"));
		expect(await waitFor(() => socket.readyState === WebSocket.OPEN)).toBe(true);
		const closeCount = closes;
		let openedOnce = 0;
		socket.addEventListener(
			"open",
			() => {
				openedOnce += 1;
			},
			{ once: true },
		);
		socket.forceReconnect();
		expect(await waitFor(() => socket.readyState === WebSocket.OPEN)).toBe(true);
		expect(closes).toBe(closeCount + 1);
		socket.forceReconnect();
		expect(await waitFor(() => socket.readyState === WebSocket.OPEN)).toBe(true);
		expect(openedOnce).toBe(1);
		socket.send("rede recuperada");
		expect(await waitFor(() => received.includes("rede recuperada"))).toBe(true);
	} finally {
		network.onLine = false;
		browser.dispatchEvent(new Event("offline"));
		server.stop(true);
		if (originalWindow) {
			Object.defineProperty(globalThis, "window", originalWindow);
		} else {
			Reflect.deleteProperty(globalThis, "window");
		}
		if (originalNavigator) {
			Object.defineProperty(globalThis, "navigator", originalNavigator);
		} else {
			Reflect.deleteProperty(globalThis, "navigator");
		}
	}
});
