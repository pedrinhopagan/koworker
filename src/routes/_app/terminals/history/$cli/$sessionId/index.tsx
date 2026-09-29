import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@/client";
import { HistoryCliSchema } from "@/api/schemas/agent-history";
import { isNotFoundError } from "@/lib/orpc-errors";
import { historySearchSchema } from "../../../-utils/history-search";

export const Route = createFileRoute("/_app/terminals/history/$cli/$sessionId/")({
	validateSearch: historySearchSchema,
	beforeLoad: async ({ context, params }) => {
		const detail = await context.queryClient
			.fetchQuery(
				orpc.agentHistory.get.queryOptions({
					input: { cli: HistoryCliSchema.parse(params.cli), sessionId: params.sessionId },
					retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
				}),
			)
			.catch((error: unknown) => {
				if (!isNotFoundError(error)) {
					throw error;
				}
				return null;
			});

		return { routeProjectId: detail?.projectId ?? undefined };
	},
});
