import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { orpc, orpcWs } from "@/client";
import {
	type AgentSessionEvent,
	type AgentSessionStatus,
	mergeAgentSessionEvents,
	pendingInteraction,
} from "@/lib/agent-session";
import { isNotFoundError } from "@/lib/orpc-errors";
import { subscribeWithRetry } from "@/lib/realtime-subscription";

// A conversa vive em duas fontes: o que o servidor já gravou (lido ao abrir e a cada reconexão) e o
// que chega ao vivo. As duas caem no mesmo merge por `seq`, então trocar de rede no meio de um turno
// não perde nem duplica bloco.
export function useAgentSession(sessionId: string) {
	const [events, setEvents] = useState<AgentSessionEvent[]>([]);
	const [live, setLive] = useState<{
		status?: AgentSessionStatus;
		busy?: boolean;
		endReason?: string;
	}>({});

	const query = useQuery({
		...orpc.agentSessions.get.queryOptions({ input: { sessionId } }),
		retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
	});
	const refetch = query.refetch;

	useEffect(() => {
		setEvents([]);
		setLive({});
	}, [sessionId]);

	useEffect(() => {
		if (!query.data) {
			return;
		}
		setEvents((current) => mergeAgentSessionEvents(current, query.data.events));
	}, [query.data]);

	const missing = isNotFoundError(query.error);

	useEffect(() => {
		// Sessão que não existe não vai passar a existir: reassinar em loop só enche o console de
		// NOT_FOUND enquanto a rota já mostra o estado vazio.
		if (missing) {
			return;
		}

		const controller = new AbortController();

		void subscribeWithRetry({
			label: "AgentSession",
			signal: controller.signal,
			subscribe: (signal) => orpcWs.agentSession.call({ sessionId }, { signal }),
			onEvent: (envelope) => {
				if (envelope.events) {
					setEvents((current) => mergeAgentSessionEvents(current, envelope.events ?? []));
				}
				setLive((current) => ({
					...current,
					...(envelope.status ? { status: envelope.status } : {}),
					...(envelope.busy === undefined ? {} : { busy: envelope.busy }),
					...(envelope.endReason ? { endReason: envelope.endReason } : {}),
				}));
			},
			onReconnect: () => void refetch(),
		});

		return () => controller.abort();
	}, [sessionId, refetch, missing]);

	const session = query.data;
	const status = live.status ?? session?.status ?? null;

	return {
		session,
		events,
		status,
		busy: live.busy ?? session?.busy ?? false,
		endReason: live.endReason ?? session?.endReason,
		pending: pendingInteraction(events),
		loading: query.isLoading,
		missing,
		error: query.error,
		refetch,
	};
}
