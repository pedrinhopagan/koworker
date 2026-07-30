import { afterAll, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { KwTerminalEvent } from "./events";
import { openKwTerminalEventStream } from "./socket";

// Daemon falso: aceita a conexão, guarda o `events.subscribe` que chegou e devolve o ack seguido das
// linhas de evento, como o kw-terminal faz.
const socketPath = join(tmpdir(), `kowork-radar-${process.pid}.sock`);

const requests: string[] = [];

const server = Bun.listen({
	unix: socketPath,
	socket: {
		data(socket, chunk) {
			requests.push(new TextDecoder().decode(chunk).trim());

			socket.write(`${JSON.stringify({ id: "sub", result: { type: "subscription_started" } })}\n`);
			socket.write(
				`${JSON.stringify({
					event: "pane.agent_status_changed",
					data: {
						pane_id: "pane_1",
						workspace_id: "ws_1",
						agent_status: "blocked",
						agent: "claude",
						activity: "esperando resposta",
					},
				})}\n{"event":"pane_exited","data":{"pane_id":"pane_1","workspace_id":"ws_1"}}\n`,
			);
		},
		open() {},
	},
});

afterAll(() => {
	server.stop(true);
});

test("entrega eventos do socket já traduzidos e descarta o ack da assinatura", async () => {
	const received: KwTerminalEvent[] = [];
	const { promise, resolve } = Promise.withResolvers<void>();

	const stream = await openKwTerminalEventStream({
		socketPath,
		subscriptions: [{ type: "pane.agent_status_changed", pane_id: "pane_1" }],
		onEvent: (event) => {
			received.push(event);
			if (received.length === 2) {
				resolve();
			}
		},
		onClose: () => {},
	});

	await promise;
	stream.close();

	expect(JSON.parse(requests[0] ?? "{}")).toMatchObject({
		method: "events.subscribe",
		params: { subscriptions: [{ type: "pane.agent_status_changed", pane_id: "pane_1" }] },
	});
	expect(received[0]).toEqual({
		event: "pane.agent_status_changed",
		data: {
			pane_id: "pane_1",
			workspace_id: "ws_1",
			agent_status: "blocked",
			agent: "claude",
			activity: "esperando resposta",
		},
	});
	expect(received[1]).toEqual({ event: "pane_exited", data: { pane_id: "pane_1" } });
});

test("fechar por decisão nossa não aciona a reconexão", async () => {
	let closed = false;

	const stream = await openKwTerminalEventStream({
		socketPath,
		subscriptions: [{ type: "pane.exited" }],
		onEvent: () => {},
		onClose: () => {
			closed = true;
		},
	});

	stream.close();
	await Bun.sleep(50);

	expect(closed).toBe(false);
});
