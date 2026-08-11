import { createFileRoute } from "@tanstack/react-router";

import { historySearchSchema } from "../../../-utils/history-search";

export const Route = createFileRoute("/_app/terminals/history/$cli/$sessionId/")({
	validateSearch: historySearchSchema,
});
