import { type KwTerminalEvent, parseKwTerminalEvent } from "./events";

export type KwTerminalEventStream = {
	close: () => void;
};

let requestCounter = 0;

// Uma conexão de assinatura com o daemon do kw-terminal: escreve o `events.subscribe` e entrega cada
// linha traduzida. `onClose` só dispara quando a queda vem do outro lado — fechar por `close()` é
// decisão nossa e não deve acionar reconexão.
export async function openKwTerminalEventStream(params: {
	socketPath: string;
	subscriptions: object[];
	onEvent: (event: KwTerminalEvent) => void;
	onClose: () => void;
}): Promise<KwTerminalEventStream> {
	const decoder = new TextDecoder();
	let pending = "";
	let closedByUs = false;

	function handleChunk(chunk: Uint8Array) {
		pending += decoder.decode(chunk, { stream: true });
		const lines = pending.split("\n");
		pending = lines.pop() ?? "";

		for (const line of lines) {
			const event = parseKwTerminalEvent(line);
			if (event) {
				params.onEvent(event);
			}
		}
	}

	function handleClose() {
		if (!closedByUs) {
			params.onClose();
		}
	}

	const socket = await Bun.connect({
		unix: params.socketPath,
		socket: {
			data: (_socket, chunk) => handleChunk(chunk),
			close: handleClose,
			error: handleClose,
		},
	});

	requestCounter += 1;
	socket.write(
		`${JSON.stringify({
			id: `kowork-radar-${requestCounter}`,
			method: "events.subscribe",
			params: { subscriptions: params.subscriptions },
		})}\n`,
	);

	return {
		close: () => {
			closedByUs = true;
			socket.end();
		},
	};
}
