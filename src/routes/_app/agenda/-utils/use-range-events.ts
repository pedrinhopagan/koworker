import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";

// Eventos que tocam a janela visível [startDate, endDate]. O bucketing por célula fica no
// componente (bucketEventsByDay), que conhece as datas exatas da grade.
export function useRangeEvents(startDate: string, endDate: string) {
	const query = useQuery(orpc.events.listByRange.queryOptions({ input: { startDate, endDate } }));

	return { events: query.data ?? [], loading: query.isLoading };
}
