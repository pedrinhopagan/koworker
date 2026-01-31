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
	status?: "pending" | "in_execution" | "executed";
	includeCompleted?: boolean;
	q?: string;
	page?: number;
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

	const includeCompleted = filters.includeCompleted ?? true;

	const tasksQuery = useQuery({
		...orpc.tasks.getAll.queryOptions({
			input: {
				projectId: selectedProjectId ?? null,
				includeCompleted,
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

	const q = filters.q?.trim().toLowerCase() ?? "";
	const page = filters.page ?? 1;
	const pageSize = 50;

	const filteredTasks = tasksWithMeta
		.filter((t) => {
			if (filters.taskTypeId && t.categoryId !== filters.taskTypeId) return false;
			if (filters.priorityId && t.priorityId !== filters.priorityId) return false;
			if (filters.status && t.status !== filters.status) return false;
			if (q) {
				const haystack = [t.title, t.description, t.notes].filter(Boolean).join(" ").toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			return true;
		})
		.slice((page - 1) * pageSize, page * pageSize);

	const pendingCount = filteredTasks.filter((t) => t.status === "pending").length;
	const executedCount = filteredTasks.filter((t) => t.status === "executed").length;

	const loading =
		projectsLoading ||
		categoriesQuery.isLoading ||
		prioritiesQuery.isLoading ||
		tasksQuery.isLoading;

	return {
		data: {
			tasks: filteredTasks,
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
