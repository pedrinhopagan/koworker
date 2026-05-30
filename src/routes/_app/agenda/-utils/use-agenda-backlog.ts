import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";
import type { TaskWithMeta } from "@/types/tasks";

// Backlog da agenda: tarefas pendentes ainda não ligadas a um event. Enriquece com categoria e
// prioridade (padrão do use-tasks-data) para o TaskItem renderizar.
export function useAgendaBacklog(projectId: string | null) {
	const backlogQuery = useQuery(
		orpc.tasks.backlog.queryOptions({ input: { projectId: projectId ?? undefined } }),
	);
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());

	const categoryMap = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));
	const priorityMap = new Map((prioritiesQuery.data ?? []).map((p) => [p.id, p]));

	const tasks: TaskWithMeta[] = (backlogQuery.data ?? []).map((task) => {
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
		});
	});

	return { tasks, loading: backlogQuery.isLoading };
}
