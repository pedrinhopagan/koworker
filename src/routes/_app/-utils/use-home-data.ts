import { useQuery } from "@tanstack/react-query";
import { orpc, type RouterOutputs } from "@/client";
import type { TaskWithMeta } from "@/types/tasks";
import { useProjectFocus } from "@/hooks";

export type Project = RouterOutputs["projects"]["list"][number];

export const MAX_VISIBLE_TASKS = 5;

export const statusLabels: Record<string, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executado",
};

export function useHomeData() {
	const { projects, selectedProjectId, loading: projectsLoading } = useProjectFocus();
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	const tasksQuery = useQuery({
		...orpc.tasks.listByProject.queryOptions({ input: { projectId: selectedProjectId ?? "" } }),
		enabled: !!selectedProjectId,
	});

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
