import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import { pendingInteraction } from "@/lib/agent-session";
import { isNotFoundError } from "@/lib/orpc-errors";

export function useAgentSession(sessionId: string) {
	const query = useQuery({
		...orpc.agentSessions.get.queryOptions({ input: { sessionId } }),
		retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
	});
	const events = query.data?.events ?? [];

	return {
		session: query.data,
		events,
		status: query.data?.status ?? null,
		busy: false,
		endReason: query.data?.endReason,
		pending: pendingInteraction(events),
		loading: query.isLoading,
		missing: isNotFoundError(query.error),
		error: query.error,
		refetch: query.refetch,
	};
}
