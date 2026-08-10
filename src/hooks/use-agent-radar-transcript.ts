import { useEffect, useRef, useState } from "react";

import type { AgentTranscript } from "@/api/helpers/agent-radar/transcript/locate";
import { orpcWs } from "@/client";
import { mergeAgentSessionEvents, type AgentSessionEvent } from "@/lib/agent-session";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

type TranscriptEnvelope = {
	events?: AgentSessionEvent[];
	reset?: boolean;
	missing?: boolean;
	source?: AgentTranscript;
};

// Um agente em rajada escreve vários blocos por segundo. Aplicar lote a lote punha a conversa inteira
// para redesenhar a cada bloco; juntar o que chegou no mesmo quadro deixa um render por rajada.
const BATCH_MS = 90;

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
	const pending = useRef<TranscriptEnvelope[]>([]);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setEvents([]);
		setSource(null);
		setMissing(false);
		setLoading(true);
		pending.current = [];

		const controller = new AbortController();

		function flush() {
			timer.current = null;
			const batch = pending.current;
			pending.current = [];
			if (batch.length === 0) {
				return;
			}

			const last = batch.at(-1);
			setLoading(false);
			setMissing(!!last?.missing);

			const nextSource = batch.findLast((envelope) => envelope.source)?.source;
			if (nextSource) {
				setSource(nextSource);
			}

			setEvents((current) =>
				batch.reduce(
					(accumulated, envelope) => applyAgentRadarTranscriptEnvelope(accumulated, envelope),
					current,
				),
			);
		}

		void subscribeWithRetry({
			label: "Radar Transcript",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.agentRadarTranscript.call({ paneId }, { signal }),
			onEvent: (envelope) => {
				pending.current.push(envelope);
				timer.current ??= setTimeout(flush, BATCH_MS);
			},
		});

		return () => {
			controller.abort();
			if (timer.current) {
				clearTimeout(timer.current);
				timer.current = null;
			}
		};
	}, [paneId]);

	return { events, source, missing, loading };
}
