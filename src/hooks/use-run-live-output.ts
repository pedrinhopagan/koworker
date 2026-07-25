import { useEffect, useState } from "react";

import { orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

export function useRunLiveOutput(input: { runId: string; enabled: boolean }) {
	const [output, setOutput] = useState("");

	useEffect(() => {
		if (!input.enabled) {
			return;
		}
		setOutput("");
		const controller = new AbortController();

		void subscribeWithRetry({
			label: "PromptRunOutput",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.promptRun.call({ runId: input.runId }, { signal }),
			onEvent: (event) => {
				if (event.status === "output") {
					setOutput(event.output ?? "");
				}
			},
		});

		return () => controller.abort();
	}, [input.runId, input.enabled]);

	return output;
}
