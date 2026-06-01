import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { orpc } from "@/client";
import type { TaskWithMeta } from "@/types/tasks";

export type BacklogGroup = {
	id: string;
	name: string;
	color: string;
	tasks: TaskWithMeta[];
};

const UNGROUPED_ID = "__ungrouped__";
const FALLBACK_COLOR = "#666";

// Backlog da agenda: tarefas pendentes ainda não ligadas a um event, separadas nos grupos a que
// pertencem. Com um projeto selecionado, agrupa por task group (o mesmo de /tarefas); em "Todos
// os projetos" (projectId undefined) agrupa por projeto, já que grupos são por-projeto e não há
// lista cross-project. Enriquece com categoria/prioridade para a linha do backlog renderizar.
export function useAgendaBacklog(projectId: string | null | undefined) {
	const backlogQuery = useQuery(
		orpc.tasks.backlog.queryOptions({ input: { projectId: projectId ?? undefined } }),
	);
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const prioritiesQuery = useQuery(orpc.priorities.list.queryOptions());
	const groupsQuery = useQuery({
		...orpc.taskGroups.list.queryOptions({ input: { projectId: projectId ?? "" } }),
		enabled: Boolean(projectId),
	});
	const projectsQuery = useQuery({
		...orpc.projects.list.queryOptions(),
		enabled: !projectId,
	});

	const groups = useMemo<BacklogGroup[]>(() => {
		const categoryMap = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c]));
		const priorityMap = new Map((prioritiesQuery.data ?? []).map((p) => [p.id, p]));

		const tasks: TaskWithMeta[] = (backlogQuery.data ?? []).map((task) => {
			const category = categoryMap.get(task.categoryId);
			const priority = priorityMap.get(task.priorityId);
			return Object.assign(task, {
				category: {
					id: category?.id ?? ``,
					name: category?.name ?? `Sem categoria`,
					color: category?.color ?? FALLBACK_COLOR,
				},
				priority: {
					id: priority?.id ?? ``,
					name: priority?.name ?? `Sem prioridade`,
					color: priority?.color ?? FALLBACK_COLOR,
				},
			});
		});

		// Eixo de agrupamento: por task group (projeto selecionado) ou por projeto ("Todos").
		const byProject = !projectId;
		const meta = new Map<string, { name: string; color: string; order: number }>();

		if (byProject) {
			(projectsQuery.data ?? []).forEach((p, index) =>
				meta.set(p.id, { name: p.name, color: p.color ?? FALLBACK_COLOR, order: index }),
			);
		} else {
			(groupsQuery.data ?? []).forEach((g) =>
				meta.set(g.id, { name: g.name, color: g.color ?? FALLBACK_COLOR, order: g.displayOrder }),
			);
		}

		const buckets = new Map<string, TaskWithMeta[]>();
		for (const task of tasks) {
			const key = (byProject ? task.projectId : task.groupId) ?? UNGROUPED_ID;
			const bucket = buckets.get(key) ?? [];
			bucket.push(task);
			buckets.set(key, bucket);
		}

		return [...buckets.entries()]
			.map(([id, groupTasks]) => {
				const info = meta.get(id);
				return {
					id,
					name: info?.name ?? (byProject ? "Sem projeto" : "Sem grupo"),
					color: info?.color ?? FALLBACK_COLOR,
					order: info?.order ?? Number.MAX_SAFE_INTEGER,
					tasks: groupTasks,
				};
			})
			.sort((a, b) => a.order - b.order)
			.map(({ order: _order, ...group }) => group);
	}, [
		backlogQuery.data,
		categoriesQuery.data,
		prioritiesQuery.data,
		groupsQuery.data,
		projectsQuery.data,
		projectId,
	]);

	const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);

	return { groups, total, loading: backlogQuery.isLoading };
}
