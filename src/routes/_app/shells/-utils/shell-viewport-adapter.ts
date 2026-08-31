import { orpcWs } from "@/client";

export function createShellViewportAdapter(shellId: string) {
	return {
		subscribe(signal: AbortSignal) {
			return orpcWs.shells.stream.call({ id: shellId }, { signal });
		},
		input(data: string) {
			return orpcWs.shells.input.call({ id: shellId, data });
		},
		resize(cols: number, rows: number) {
			return orpcWs.shells.resize.call({ id: shellId, cols, rows });
		},
	};
}
