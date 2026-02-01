import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import { useProjectFocus } from "@/hooks";
import type { TaskWithMeta } from "@/types/tasks";

const statusLabels: Record<string, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executado",
};

export type TasksSearchFilters = {
	projectId?: string;
	taskTypeId?: string;
	priorityId?: string;
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
		// When the project is coming from the URL, avoid syncing it into the global store.
		syncToStore: !preferredProjectId,
	});
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	const searchQuery = filters.q?.trim();

	const projectIdForQuery = filters.projectId ?? selectedProjectId ?? null;

	const tasksQuery = useQuery({
		...orpc.tasks.getAll.queryOptions({
			input: {
				projectId: projectIdForQuery,
				includeCompleted: filters.includeCompleted ?? false,
				taskTypeId: filters.taskTypeId,
				priorityId: filters.priorityId,
				q: searchQuery && searchQuery.length > 0 ? searchQuery : undefined,
			},
		}),
	});

	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];
	const rawTasks = tasksQuery.data ?? [];

	const categoryMap = new Map(categories.map((c) => [c.id, c]));
	const priorityMap = new Map(priorities.map((p) => [p.id, p]));

	const tasksWithMeta: TaskWithMeta[] = rawTasks.map((task) => {
		const cat = categoryMap.get(task.categoryId);
		const pri = priorityMap.get(task.priorityId);
		return Object.assign(task, {
			category: {
				id: cat?.id ?? ``,
				name: cat?.name ?? `Sem categoria`,
				color: cat?.color ?? `#666`,
			},
			priority: {
				id: pri?.id ?? ``,
				name: pri?.name ?? `Sem prioridade`,
				color: pri?.color ?? `#666`,
			},
			statusLabel: statusLabels[task.status] ?? task.status,
		});
	});

	const pendingCount = tasksWithMeta.filter((t) => !t.completedAt).length;
	const executedCount = tasksWithMeta.filter((t) => t.completedAt).length;

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
			selectedProjectId,
			pendingCount,
			executedCount,
		},

		loading,
	};
}
