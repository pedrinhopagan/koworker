const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 15_000;

export type ResilientWebSocket = Pick<WebSocket, "addEventListener" | "send" | "readyState"> & {
	forceReconnect: () => void;
};

export function createResilientWebSocket(url: string): ResilientWebSocket {
	const events = new EventTarget();
	const pending: (string | ArrayBufferLike | Blob | ArrayBufferView)[] = [];
	let socket: WebSocket | null = null;
	let retryDelay = RECONNECT_MIN_MS;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	function connect() {
		if (typeof navigator !== "undefined" && navigator.onLine === false) {
			return;
		}
		if (
			socket &&
			(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
		) {
			return;
		}
		const next = new WebSocket(url);
		socket = next;
		next.addEventListener("open", () => {
			if (socket !== next) {
				return;
			}
			retryDelay = RECONNECT_MIN_MS;
			events.dispatchEvent(new Event("open"));
			while (pending.length && next.readyState === WebSocket.OPEN) {
				next.send(pending.shift()!);
			}
		});
		next.addEventListener("message", (event) => {
			if (socket === next) {
				events.dispatchEvent(new MessageEvent("message", { data: event.data }));
			}
		});
		next.addEventListener("close", () => {
			if (socket !== next) {
				return;
			}
			socket = null;
			pending.length = 0;
			events.dispatchEvent(new Event("close"));
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				connect();
			}, retryDelay);
			retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX_MS);
		});
		next.addEventListener("error", () => {
			if (socket === next) {
				events.dispatchEvent(new Event("error"));
				next.close();
			}
		});
	}

	function disconnect() {
		const current = socket;
		socket = null;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		pending.length = 0;
		current?.close();
		events.dispatchEvent(new Event("close"));
	}

	function forceReconnect() {
		disconnect();
		retryDelay = RECONNECT_MIN_MS;
		connect();
	}

	connect();
	if (typeof document !== "undefined") {
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				forceReconnect();
			}
		});
	}
	if (typeof window !== "undefined") {
		window.addEventListener("offline", disconnect);
		window.addEventListener("online", forceReconnect);
		window.addEventListener("focus", connect);
	}

	return {
		addEventListener: events.addEventListener.bind(events),
		send(data) {
			if (socket?.readyState === WebSocket.OPEN) {
				socket.send(data);
				return;
			}
			pending.push(data);
			connect();
		},
		get readyState() {
			return socket?.readyState ?? WebSocket.CLOSED;
		},
		forceReconnect,
	};
}
