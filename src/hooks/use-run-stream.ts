import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { orpc, orpcWs } from "@/client";
import { mergeAgentSteps, type AgentStep } from "@/lib/agent-stream";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

// O acompanhamento vive em duas fontes: o que o executor guardou até agora (buscado ao abrir e a cada
// reconexão) e o que chega ao vivo. As duas caem no mesmo merge por sequência, então trocar de rede no
// meio da execução não perde nem duplica passo.
export function useRunStream(input: { runId: string; enabled: boolean }) {
	const [steps, setSteps] = useState<AgentStep[]>([]);

	const snapshot = useQuery({
		...orpc.prompt.runSteps.queryOptions({ input: { runId: input.runId } }),
		enabled: input.enabled,
		staleTime: 0,
	});
	const refetchSnapshot = snapshot.refetch;

	useEffect(() => {
		setSteps([]);
	}, [input.runId]);

	useEffect(() => {
		if (!snapshot.data) {
			return;
		}
		setSteps((current) => mergeAgentSteps(current, snapshot.data.steps));
	}, [snapshot.data]);

	useEffect(() => {
		if (!input.enabled) {
			return;
		}
		const controller = new AbortController();

		void subscribeWithRetry({
			label: "PromptRunSteps",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.promptRun.call({ runId: input.runId }, { signal }),
			onEvent: (event) => {
				if (event.status === "step" && event.steps) {
					setSteps((current) => mergeAgentSteps(current, event.steps ?? []));
				}
			},
			onReconnect: () => void refetchSnapshot(),
		});

		return () => controller.abort();
	}, [input.runId, input.enabled, refetchSnapshot]);

	return steps;
}
