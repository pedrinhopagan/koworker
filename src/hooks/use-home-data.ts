import { useQuery } from "@tanstack/react-query";
import { orpc, type RouterOutputs } from "@/client";
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
		const category = task.categoryId ? categoryMap.get(task.categoryId) : undefined;
		const priority = task.priorityId ? priorityMap.get(task.priorityId) : undefined;
		return Object.assign(task, {
			category: category ? { id: category.id, name: category.name, color: category.color } : null,
			priority: priority ? { id: priority.id, name: priority.name, color: priority.color } : null,
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
