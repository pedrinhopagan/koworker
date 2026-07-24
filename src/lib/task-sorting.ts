import { TASK_COMPLEXITIES } from "@/constants/complexity";
import type { TaskSortMode } from "@/constants/tasks";
import type { TaskWithMeta } from "@/types/tasks";

export function sortTasksByMode(
	tasks: TaskWithMeta[],
	mode: TaskSortMode,
	categories: { id: string; displayOrder: number }[],
	priorities: { id: string; level: number }[],
) {
	const categoryOrder = new Map(categories.map((category) => [category.id, category.displayOrder]));
	const priorityLevel = new Map(priorities.map((priority) => [priority.id, priority.level]));

	return [...tasks].sort((a, b) => {
		if (a.done !== b.done) {
			return a.done ? 1 : -1;
		}

		if (mode === "categoria") {
			const aOrder = a.categoryId ? categoryOrder.get(a.categoryId) : undefined;
			const bOrder = b.categoryId ? categoryOrder.get(b.categoryId) : undefined;
			if (aOrder !== bOrder) {
				return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
			}
		}

		if (mode === "prioridade") {
			const aLevel = a.priorityId ? priorityLevel.get(a.priorityId) : undefined;
			const bLevel = b.priorityId ? priorityLevel.get(b.priorityId) : undefined;
			if (aLevel !== bLevel) {
				return (aLevel ?? Number.MAX_SAFE_INTEGER) - (bLevel ?? Number.MAX_SAFE_INTEGER);
			}
		}

		if (mode === "complexidade") {
			const difference =
				TASK_COMPLEXITIES.indexOf(b.complexity) - TASK_COMPLEXITIES.indexOf(a.complexity);
			if (difference !== 0) {
				return difference;
			}
		}

		if (mode === "recente" && a.lastEditedAt !== b.lastEditedAt) {
			return b.lastEditedAt - a.lastEditedAt;
		}

		if (mode === "alfabetica") {
			const difference = a.displayTitle.localeCompare(b.displayTitle, "pt-BR");
			if (difference !== 0) {
				return difference;
			}
		}

		if (a.displayOrder !== b.displayOrder) {
			return a.displayOrder - b.displayOrder;
		}

		return b.createdAt - a.createdAt;
	});
}
