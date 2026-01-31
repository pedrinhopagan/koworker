import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/client";
import { useProjectFocus } from "@/hooks";
import type { TaskWithMeta } from "@/types/tasks";

const statusLabels: Record<string, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executado",
};

export type TasksByDate = Map<string, TaskWithMeta[]>;

export function useWeekTasks(startDate: string, endDate: string) {
	const queryClient = useQueryClient();
	const { selectedProjectId } = useProjectFocus();
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	const tasksQuery = useQuery({
		...orpc.tasks.getAll.queryOptions({
			input: { startDate, endDate, projectId: selectedProjectId ?? null },
		}),
		enabled: !!startDate && !!endDate,
	});

	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];
	const rawTasks = tasksQuery.data ?? [];

	const tasks: TaskWithMeta[] = useMemo(() => {
		const categoryMap = new Map(categories.map((c) => [c.id, c]));
		const priorityMap = new Map(priorities.map((p) => [p.id, p]));

		return rawTasks.map((task) => {
			const cat = categoryMap.get(task.categoryId);
			const pri = priorityMap.get(task.priorityId);
			return {
				...task,
				category: {
					id: cat?.id ?? "",
					name: cat?.name ?? "Sem categoria",
					color: cat?.color ?? "#666",
				},
				priority: {
					id: pri?.id ?? "",
					name: pri?.name ?? "Sem prioridade",
					color: pri?.color ?? "#666",
				},
				statusLabel: statusLabels[task.status] ?? task.status,
			};
		});
	}, [rawTasks, categories, priorities]);

	const tasksByDate: TasksByDate = useMemo(() => {
		const map = new Map<string, TaskWithMeta[]>();
		for (const task of tasks) {
			if (task.scheduledDate) {
				const existing = map.get(task.scheduledDate) ?? [];
				existing.push(task);
				map.set(task.scheduledDate, existing);
			}
		}
		return map;
	}, [tasks]);

	const loading = categoriesQuery.isLoading || prioritiesQuery.isLoading || tasksQuery.isLoading;

	const refetch = () => {
		queryClient.invalidateQueries({ queryKey: ["tasks"] });
	};

	return {
		tasks,
		tasksByDate,
		loading,
		refetch,
	};
}
