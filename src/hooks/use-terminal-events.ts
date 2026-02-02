import { useEffect } from "react";

import { orpcWs } from "@/client";
import { useTerminalStatusStore } from "@/stores/terminal-status";

export function useTerminalEvents() {
	const handleEvent = useTerminalStatusStore((state) => state.handleEvent);

	useEffect(() => {
		const controller = new AbortController();

		async function subscribe() {
			try {
				const events = await orpcWs.terminal.events.call(undefined, {
					signal: controller.signal,
				});

				for await (const event of events) {
					handleEvent(event);
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					return;
				}
				console.error("[Terminal Events] Erro na subscription:", error);
			}
		}

		subscribe();

		return () => {
			controller.abort();
		};
	}, [handleEvent]);
}
