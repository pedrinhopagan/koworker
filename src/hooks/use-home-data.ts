import { useQuery } from "@tanstack/react-query";
import { orpc, type RouterOutputs } from "@/client";
import { getStatusLabel } from "@/domain/tasks/status";
import { useProjectFocus } from "@/hooks";
import type { TaskWithMeta } from "@/types/tasks";

export type Project = RouterOutputs["projects"]["list"][number];

export const MAX_VISIBLE_TASKS = 5;

export function useHomeData() {
	const { projects, selectedProjectId, loading: projectsLoading } = useProjectFocus();
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	const tasksQuery = useQuery({
		...orpc.tasks.getAll.queryOptions({ input: { projectId: selectedProjectId ?? null } }),
	});

	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];
	const rawTasks = tasksQuery.data ?? [];

	const categoryMap = new Map(categories.map((category) => [category.id, category]));
	const priorityMap = new Map(priorities.map((priority) => [priority.id, priority]));

	const tasks: TaskWithMeta[] = rawTasks.map((task) => {
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

	const loading =
		projectsLoading ||
		categoriesQuery.isLoading ||
		prioritiesQuery.isLoading ||
		tasksQuery.isLoading;

	return {
		tasks,
		projects,
		loading,
	};
}
