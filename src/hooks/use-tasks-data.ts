import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/client";
import { useProjectFocus } from "./use-project-focus";

const TASKS_PAGE_SIZE = 50;

export type TasksSearchFilters = {
	projectId?: string;
	groupId?: string | null;
	q?: string;
	includeCompleted?: boolean;
};

export function useTasksData(filters: TasksSearchFilters) {
	const preferredProjectId = filters.projectId ?? null;

	const {
		projects,
		selectedProjectId,
		loading: projectsLoading,
	} = useProjectFocus({
		preferredProjectId,
		syncToStore: !preferredProjectId,
	});
	// "Todos" => selectedProjectId === undefined => sem filtro => o backend devolve os grupos de
	// todos os projetos (cada um carrega projectId). Não coagir undefined para "".
	const projectIdForGroups = filters.projectId ?? selectedProjectId ?? undefined;
	const groupsQuery = useQuery(
		orpc.taskGroups.list.queryOptions({ input: { projectId: projectIdForGroups } }),
	);

	const searchQuery = filters.q?.trim();
	const projectIdForQuery = filters.projectId ?? selectedProjectId ?? null;

	const tasksInput = {
		projectId: projectIdForQuery,
		includeCompleted: filters.includeCompleted ?? false,
		groupId: filters.groupId,
		q: searchQuery && searchQuery.length > 0 ? searchQuery : undefined,
	};
	const tasksQueryKey = [
		...orpc.tasks.getAll.queryKey({
			input: { ...tasksInput, limit: TASKS_PAGE_SIZE + 1, offset: 0 },
		}),
		"infinite",
	] as const;
	const tasksQuery = useInfiniteQuery({
		queryKey: tasksQueryKey,
		queryFn: async ({ pageParam, signal }) => {
			const rows = await orpc.tasks.getAll.call(
				{ ...tasksInput, limit: TASKS_PAGE_SIZE + 1, offset: pageParam },
				{ signal },
			);
			return {
				tasks: rows.slice(0, TASKS_PAGE_SIZE),
				nextOffset: rows.length > TASKS_PAGE_SIZE ? pageParam + TASKS_PAGE_SIZE : undefined,
			};
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage) => lastPage.nextOffset,
		// Cada tecla da busca muda a queryKey; sem isso a lista inteira desmonta pro "Carregando"
		// e remonta a cada caractere digitado.
		placeholderData: keepPreviousData,
	});

	const metricsQuery = useQuery(
		orpc.tasks.metrics.queryOptions({ input: { projectId: projectIdForQuery } }),
	);

	const groups = groupsQuery.data ?? [];

	const pendingCount = metricsQuery.data?.pending ?? 0;
	const executedCount = metricsQuery.data?.done ?? 0;

	const loading = projectsLoading || tasksQuery.isLoading;

	const isError = tasksQuery.isError;

	return {
		data: {
			tasks: useMemo(
				() => tasksQuery.data?.pages.flatMap((page) => page.tasks) ?? [],
				[tasksQuery.data],
			),
			projects,
			groups,
			selectedProjectId,
			pendingCount,
			executedCount,
		},
		loading,
		isError,
		refetch: tasksQuery.refetch,
		hasMore: tasksQuery.hasNextPage,
		loadingMore: tasksQuery.isFetchingNextPage,
		loadMore: tasksQuery.fetchNextPage,
	};
}
