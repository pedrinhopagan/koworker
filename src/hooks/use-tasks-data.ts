import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import type { TaskComplexity } from "@/constants/complexity";
import type { TaskWithMeta } from "@/types/tasks";
import { useProjectFocus } from "./use-project-focus";

export type TasksSearchFilters = {
	projectId?: string;
	taskTypeId?: string;
	priorityId?: string;
	complexity?: TaskComplexity;
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
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	// "Todos" => selectedProjectId === undefined => sem filtro => o backend devolve os grupos de
	// todos os projetos (cada um carrega projectId). Não coagir undefined para "".
	const projectIdForGroups = filters.projectId ?? selectedProjectId ?? undefined;
	const groupsQuery = useQuery(
		orpc.taskGroups.list.queryOptions({ input: { projectId: projectIdForGroups } }),
	);

	const searchQuery = filters.q?.trim();
	const projectIdForQuery = filters.projectId ?? selectedProjectId ?? null;

	const tasksQuery = useQuery({
		...orpc.tasks.getAll.queryOptions({
			input: {
				projectId: projectIdForQuery,
				includeCompleted: filters.includeCompleted ?? false,
				taskTypeId: filters.taskTypeId,
				priorityId: filters.priorityId,
				complexity: filters.complexity,
				q: searchQuery && searchQuery.length > 0 ? searchQuery : undefined,
			},
		}),
	});

	const metricsQuery = useQuery(
		orpc.tasks.metrics.queryOptions({ input: { projectId: projectIdForQuery } }),
	);

	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];
	const groups = groupsQuery.data ?? [];
	const rawTasks = tasksQuery.data ?? [];

	const categoryMap = new Map(categories.map((category) => [category.id, category]));
	const priorityMap = new Map(priorities.map((priority) => [priority.id, priority]));

	const tasksWithMeta: TaskWithMeta[] = rawTasks.map((task) => {
		const category = task.categoryId ? categoryMap.get(task.categoryId) : undefined;
		const priority = task.priorityId ? priorityMap.get(task.priorityId) : undefined;
		return Object.assign(task, {
			category: category ? { id: category.id, name: category.name, color: category.color } : null,
			priority: priority ? { id: priority.id, name: priority.name, color: priority.color } : null,
		});
	});

	const pendingCount = metricsQuery.data?.pending ?? 0;
	const executedCount = metricsQuery.data?.done ?? 0;

	const loading =
		projectsLoading ||
		categoriesQuery.isLoading ||
		prioritiesQuery.isLoading ||
		tasksQuery.isLoading;

	return {
		data: {
			tasks: tasksWithMeta,
			projects,
			categories,
			priorities,
			groups,
			selectedProjectId,
			pendingCount,
			executedCount,
		},
		loading,
	};
}
