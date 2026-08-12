import { useEffect, useRef, useState } from "react";

import type { AgentRadarTranscriptEnvelope } from "@/api/helpers/agent-radar/transcript";
import type { AgentTranscript } from "@/api/helpers/agent-radar/transcript/locate";
import { orpcWs } from "@/client";
import { mergeAgentSessionEvents, type AgentSessionEvent } from "@/lib/agent-session";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

type TranscriptEnvelope = Pick<
	AgentRadarTranscriptEnvelope,
	"events" | "missing" | "model" | "reset" | "source"
>;

// Um agente em rajada escreve vários blocos por segundo. Aplicar lote a lote punha a conversa inteira
// para redesenhar a cada bloco; juntar o que chegou no mesmo quadro deixa um render por rajada.
const BATCH_MS = 90;

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
	const [model, setModel] = useState<string | null>(null);
	const [missing, setMissing] = useState(false);
	const [loading, setLoading] = useState(true);
	const pending = useRef<TranscriptEnvelope[]>([]);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setEvents([]);
		setSource(null);
		setModel(null);
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

			setSource((current) =>
				batch.reduce(
					(accumulated, envelope) => applyAgentRadarTranscriptSource(accumulated, envelope),
					current,
				),
			);

			// O `reset` recomeça a conversa em outro arquivo: o modelo da sessão anterior não vale mais
			// até o transcript novo reportar o dele.
			let nextModel: string | null | undefined;
			for (const envelope of batch) {
				if (envelope.reset) {
					nextModel = envelope.model ?? null;
				} else if (envelope.model) {
					nextModel = envelope.model;
				}
			}
			if (nextModel !== undefined) {
				setModel(nextModel);
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

	return { events, source, model, missing, loading };
}
