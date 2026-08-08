import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Sem uma origem real o documento nasce em `about:blank`, e qualquer módulo que monte uma URL a
// partir de `window.location.origin` (o cliente ORPC, por exemplo) quebra ao ser importado.
GlobalRegistrator.register({ url: "http://localhost:2841/" });

class TestWebSocket extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;
	readyState = TestWebSocket.CONNECTING;

	send() {}
	close() {}
}

globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
