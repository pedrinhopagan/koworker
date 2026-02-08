import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import { getStatusLabel, getTaskStatusOptions, type TaskStatus } from "@/domain/tasks/status";
import type { TaskWithMeta } from "@/types/tasks";
import { useProjectFocus } from "./use-project-focus";

export type TasksSearchFilters = {
	projectId?: string;
	taskTypeId?: string;
	priorityId?: string;
	statusIds?: string[];
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
	const statusOptions = getTaskStatusOptions();
	const allowedStatusIds = new Set(statusOptions.map((status) => status.id));
	const selectedStatusIds =
		filters.statusIds
			?.filter((statusId): statusId is TaskStatus => allowedStatusIds.has(statusId as TaskStatus))
			.filter((statusId, index, array) => array.indexOf(statusId) === index) ?? [];
	const hasStatusFilter =
		selectedStatusIds.length > 0 && selectedStatusIds.length < statusOptions.length;
	const selectedStatusSet = new Set(selectedStatusIds);

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
	const filteredTasks = hasStatusFilter
		? rawTasks.filter((task) => selectedStatusSet.has(task.status as TaskStatus))
		: rawTasks;

	const categoryMap = new Map(categories.map((category) => [category.id, category]));
	const priorityMap = new Map(priorities.map((priority) => [priority.id, priority]));

	const tasksWithMeta: TaskWithMeta[] = filteredTasks.map((task) => {
		const category = categoryMap.get(task.categoryId);
		const priority = priorityMap.get(task.priorityId);
		return Object.assign(task, {
			category: {
				id: category?.id ?? "",
				name: category?.name ?? "Sem categoria",
				color: category?.color ?? "#666",
			},
			priority: {
				id: priority?.id ?? "",
				name: priority?.name ?? "Sem prioridade",
				color: priority?.color ?? "#666",
			},
			statusLabel: getStatusLabel(task.status),
		});
	});

	const pendingCount = tasksWithMeta.filter((task) => !task.completedAt).length;
	const executedCount = tasksWithMeta.filter((task) => task.completedAt).length;

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
			statuses: statusOptions,
			selectedProjectId,
			pendingCount,
			executedCount,
		},
		loading,
	};
}
