// O socket do ORPC é criado uma vez na carga do módulo. No PWA do celular isso não sobrevive ao uso
// real: o sistema congela a aba ao trocar de app, o Wi-Fi cai no meio do caminho e o socket fecha
// para nunca mais voltar — a partir daí nada chega ao vivo até um reload completo. Este proxy expõe
// a fatia de WebSocket que o link consome (`addEventListener`, `send`, `readyState`) e troca o socket
// por baixo, reanexando os listeners e drenando o que foi enviado enquanto estava fora do ar.
const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 15_000;

type SocketListener = {
	type: string;
	listener: EventListenerOrEventListenerObject;
	options?: boolean | AddEventListenerOptions;
};

export type ResilientWebSocket = Pick<WebSocket, "addEventListener" | "send" | "readyState">;

export function createResilientWebSocket(url: string): ResilientWebSocket {
	const listeners: SocketListener[] = [];
	const pending: (string | ArrayBufferLike | Blob | ArrayBufferView)[] = [];
	let socket: WebSocket | null = null;
	let retryDelay = RECONNECT_MIN_MS;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	function flushPending(target: WebSocket) {
		while (pending.length > 0 && target.readyState === WebSocket.OPEN) {
			const message = pending.shift();
			if (message !== undefined) {
				target.send(message);
			}
		}
	}

	function scheduleReconnect() {
		if (reconnectTimer) {
			return;
		}

		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect();
		}, retryDelay);
		retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX_MS);
	}

	function connect() {
		if (
			socket &&
			(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
		) {
			return;
		}

		const next = new WebSocket(url);
		socket = next;
		for (const entry of listeners) {
			next.addEventListener(entry.type, entry.listener, entry.options);
		}
		next.addEventListener("open", () => {
			retryDelay = RECONNECT_MIN_MS;
			flushPending(next);
		});
		next.addEventListener("close", () => {
			if (socket === next) {
				scheduleReconnect();
			}
		});
		next.addEventListener("error", () => {
			if (socket === next) {
				next.close();
			}
		});
	}

	function reconnectNow() {
		if (socket?.readyState === WebSocket.OPEN) {
			return;
		}
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		retryDelay = RECONNECT_MIN_MS;
		connect();
	}

	connect();

	if (typeof document !== "undefined") {
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				reconnectNow();
			}
		});
	}
	if (typeof window !== "undefined") {
		window.addEventListener("online", reconnectNow);
		window.addEventListener("focus", reconnectNow);
	}

	return {
		addEventListener(
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions,
		) {
			listeners.push({ type, listener, options });
			socket?.addEventListener(type, listener, options);
		},
		send(data) {
			if (socket?.readyState === WebSocket.OPEN) {
				socket.send(data);
				return;
			}

			pending.push(data);
			reconnectNow();
		},
		get readyState() {
			return socket?.readyState ?? WebSocket.CLOSED;
		},
	};
}
