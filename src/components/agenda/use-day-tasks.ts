import { useQuery, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { useProjectFocus } from "@/hooks";
import type { TaskWithMeta } from "@/types/tasks";

const statusLabels: Record<string, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executado",
};

export function useDayTasks(date: string | null) {
	const queryClient = useQueryClient();
	const { selectedProjectId } = useProjectFocus();
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	const tasksQuery = useQuery({
		...orpc.tasks.listByDate.queryOptions({
			input: { date: date ?? "", projectId: selectedProjectId ?? null },
		}),
		enabled: !!date && !!selectedProjectId,
	});

	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];
	const rawTasks = tasksQuery.data ?? [];

	type Category = (typeof categories)[number];
	type Priority = (typeof priorities)[number];

	const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
	const priorityMap = new Map<string, Priority>(priorities.map((p) => [p.id, p]));

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

	const loading = categoriesQuery.isLoading || prioritiesQuery.isLoading || tasksQuery.isLoading;

	const refetch = () => {
		queryClient.invalidateQueries({ queryKey: ["tasks"] });
	};

	return {
		tasks,
		loading,
		refetch,
	};
}
