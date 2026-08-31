import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/client";
import type { HistoryCli } from "@/api/schemas/agent-history";

export type CliHistoryFilters = {
	projectId: string | null;
	cli: HistoryCli | null;
	search: string;
};

const PAGE_SIZE = 24;

// A lista cresce por página em vez de paginar de verdade: o backend só lê por inteiro os transcripts
// que vão aparecer, e pedir de novo os primeiros custa quase nada porque já estão em cache lá.
export function useCliHistory(filters: CliHistoryFilters) {
	const [limit, setLimit] = useState(PAGE_SIZE);
	const query = useQuery({
		...orpc.agentHistory.list.queryOptions({
			input: { ...filters, limit, offset: 0 },
		}),
		placeholderData: (previous) => previous,
	});

	return {
		sessions: query.data?.sessions ?? [],
		total: query.data?.total ?? 0,
		hasMore: query.data?.hasMore ?? false,
		loading: query.isLoading,
		refreshing: query.isFetching && !query.isLoading,
		loadMore: () => setLimit((current) => current + PAGE_SIZE),
		resetPaging: () => setLimit(PAGE_SIZE),
	};
}
