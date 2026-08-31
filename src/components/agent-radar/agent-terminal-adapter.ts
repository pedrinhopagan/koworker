import { orpcWs } from "@/client";

export function createAgentTerminalAdapter(paneId: string) {
	return {
		subscribe(signal: AbortSignal) {
			return orpcWs.agentTerminal.stream.call({ paneId }, { signal });
		},
		input(data: string) {
			return orpcWs.agentTerminal.input.call({ paneId, data });
		},
		resize(cols: number, rows: number) {
			return orpcWs.agentTerminal.resize.call({ paneId, cols, rows });
		},
		scroll(delta: number) {
			return orpcWs.agentTerminal.scroll.call({ paneId, delta });
		},
	};
}
