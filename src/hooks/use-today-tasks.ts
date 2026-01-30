import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import type { TaskWithMeta } from "@/types/tasks";

const statusLabels: Record<string, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executado",
};

/**
 * Hook para buscar e gerenciar tarefas agendadas para hoje
 */
export function useTodayTasks() {
	const queryClient = useQueryClient();

	// Data de hoje no formato YYYY-MM-DD
	const today = useMemo(() => new Date().toISOString().split("T")[0], []);

	// Queries
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const tasksQuery = useQuery(orpc.tasks.listByDate.queryOptions({ input: { date: today } }));

	const categories = categoriesQuery.data ?? [];
	const priorities = prioritiesQuery.data ?? [];
	const rawTasks = tasksQuery.data ?? [];

	type Category = (typeof categories)[number];
	type Priority = (typeof priorities)[number];

	const categoryMap = useMemo(
		() => new Map<string, Category>(categories.map((c) => [c.id, c])),
		[categories],
	);
	const priorityMap = useMemo(
		() => new Map<string, Priority>(priorities.map((p) => [p.id, p])),
		[priorities],
	);

	// Mapear tarefas para TaskWithMeta
	const tasks: TaskWithMeta[] = useMemo(
		() =>
			rawTasks.map((task) => {
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
			}),
		[rawTasks, categoryMap, priorityMap],
	);

	// Contadores
	const count = useMemo(
		() => ({
			total: tasks.length,
			done: tasks.filter((t) => t.status === "executed").length,
		}),
		[tasks],
	);

	// Mutation para alternar status
	const updateStatusMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tasks"] });
		},
	});

	const toggleStatus = useCallback(
		(taskId: string) => {
			const task = tasks.find((t) => t.id === taskId);
			if (!task) return;

			const newStatus = task.status === "executed" ? "pending" : "executed";
			updateStatusMutation.mutate(
				{ id: taskId, status: newStatus as "pending" | "in_execution" | "executed" },
				{ onError: (e) => console.error("Failed to toggle task status:", e) },
			);
		},
		[tasks, updateStatusMutation],
	);

	const isLoading = categoriesQuery.isLoading || prioritiesQuery.isLoading || tasksQuery.isLoading;

	return {
		tasks,
		isLoading,
		toggleStatus,
		count,
	};
}
