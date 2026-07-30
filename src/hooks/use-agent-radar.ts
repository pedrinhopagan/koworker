import { useEffect, useState } from "react";

import type { RadarAgent } from "@/api/helpers/agent-radar/state";
import { orpcWs } from "@/client";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

// A assinatura abre com o mapa inteiro e cada mudança traz o mapa inteiro de novo, então o estado do
// hook é sempre o último snapshot: reconexão não precisa remontar nada.
export function useAgentRadar() {
	const [agents, setAgents] = useState<RadarAgent[] | null>(null);

	useEffect(() => {
		const controller = new AbortController();

		subscribeWithRetry({
			label: "Agent Radar",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.agentRadar.call(undefined, { signal }),
			onEvent: (event) => setAgents(event.agents),
		});

		return () => controller.abort();
	}, []);

	return { agents: agents ?? [], loading: agents === null };
}
