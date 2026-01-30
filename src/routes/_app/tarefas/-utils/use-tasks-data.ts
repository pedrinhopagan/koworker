import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import type { TaskWithMeta } from "@/types/tasks";

const statusLabels: Record<string, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executado",
};

export function useTasksData(projectId: string | undefined) {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	const selectedProjectId = projectId ?? projectsQuery.data?.[0]?.id;

	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId: selectedProjectId ?? "" } }),
		enabled: !!selectedProjectId,
	});

	const projects = projectsQuery.data ?? [];
	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];
	const rawTasks = tasksQuery.data ?? [];

	const categoryMap = new Map(categories.map((c) => [c.id, c]));
	const priorityMap = new Map(priorities.map((p) => [p.id, p]));

	const tasks: TaskWithMeta[] = rawTasks.map((task) => {
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

	const pendingCount = tasks.filter((t) => t.status === "pending").length;
	const executedCount = tasks.filter((t) => t.status === "executed").length;

	const loading =
		projectsQuery.isLoading ||
		categoriesQuery.isLoading ||
		prioritiesQuery.isLoading ||
		tasksQuery.isLoading;

	return {
		data: {
			tasks,
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
