import { useEffect, useState } from "react";

import type { AgentRadarTranscriptEnvelope } from "@/api/helpers/agent-radar/transcript";
import type { AgentTranscript } from "@/api/helpers/agent-radar/transcript/locate";
import { orpcWs } from "@/client";
import { mergeAgentSessionEvents, type AgentSessionEvent } from "@/lib/agent-session";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

type TranscriptEnvelope = Pick<
	AgentRadarTranscriptEnvelope,
	"events" | "missing" | "reset" | "source"
>;

export function applyAgentRadarTranscriptEnvelope(
	current: AgentSessionEvent[],
	envelope: TranscriptEnvelope,
) {
	const incoming = envelope.events ?? [];

	return envelope.reset ? incoming : mergeAgentSessionEvents(current, incoming);
}

export function applyAgentRadarTranscriptSource(
	current: AgentTranscript | null,
	envelope: TranscriptEnvelope,
) {
	return envelope.reset ? (envelope.source ?? null) : (envelope.source ?? current);
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
				setSource((current) => applyAgentRadarTranscriptSource(current, envelope));
				setEvents((current) => applyAgentRadarTranscriptEnvelope(current, envelope));
			},
		});

		return () => controller.abort();
	}, [paneId]);

	return { events, source, missing, loading };
}
