import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@/client";
import { isNotFoundError } from "@/lib/orpc-errors";

export const Route = createFileRoute("/_app/executar/$executionId/")({
	beforeLoad: async ({ context, params }) => {
		const session = await context.queryClient
			.fetchQuery(
				orpc.agentSessions.get.queryOptions({
					input: { sessionId: params.executionId },
					retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
				}),
			)
			.catch((error: unknown) => {
				if (!isNotFoundError(error)) {
					throw error;
				}
				return null;
			});

		if (session) {
			return { routeProjectId: session.projectId };
		}

		const thread = await context.queryClient
			.fetchQuery(
				orpc.prompt.thread.queryOptions({
					input: { runId: params.executionId },
					retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
				}),
			)
			.catch((error: unknown) => {
				if (!isNotFoundError(error)) {
					throw error;
				}
				return null;
			});

		return { routeProjectId: thread?.projectId };
	},
});
