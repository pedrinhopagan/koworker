import { useEffect } from "react";

import { orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";
import { useTerminalStatusStore } from "@/stores/terminal-status";

export function useTerminalEvents() {
	const handleEvent = useTerminalStatusStore((state) => state.handleEvent);

	useEffect(() => {
		const controller = new AbortController();

		subscribeWithRetry({
			label: "Terminal Events",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.terminal.events.call(undefined, { signal }),
			onEvent: handleEvent,
		});

		return () => controller.abort();
	}, [handleEvent]);
}
