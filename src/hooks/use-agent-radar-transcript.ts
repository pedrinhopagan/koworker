import { useEffect, useState } from "react";

import type { AgentTranscript } from "@/api/helpers/agent-radar/transcript/locate";
import { orpcWs } from "@/client";
import { mergeAgentSessionEvents, type AgentSessionEvent } from "@/lib/agent-session";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

export function applyAgentRadarTranscriptEnvelope(
	current: AgentSessionEvent[],
	envelope: { events?: AgentSessionEvent[]; reset?: boolean },
) {
	const incoming = envelope.events ?? [];

	return envelope.reset ? incoming : mergeAgentSessionEvents(current, incoming);
}

// A conversa que o CLI de um pane grava no disco. O lote marcado com `reset` é a conversa inteira
// de novo (arquivo trocado, sessão nova): substituir é obrigatório, porque os `seq` recomeçaram.
export function useAgentRadarTranscript(paneId: string) {
	const [events, setEvents] = useState<AgentSessionEvent[]>([]);
	const [source, setSource] = useState<AgentTranscript | null>(null);
	const [missing, setMissing] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setEvents([]);
		setSource(null);
		setMissing(false);
		setLoading(true);

		const controller = new AbortController();

		void subscribeWithRetry({
			label: "Radar Transcript",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.agentRadarTranscript.call({ paneId }, { signal }),
			onEvent: (envelope) => {
				setLoading(false);
				setMissing(!!envelope.missing);

				if (envelope.source) {
					setSource(envelope.source);
				}

				setEvents((current) => applyAgentRadarTranscriptEnvelope(current, envelope));
			},
		});

		return () => controller.abort();
	}, [paneId]);

	return { events, source, missing, loading };
}
