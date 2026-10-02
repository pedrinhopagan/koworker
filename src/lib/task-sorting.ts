import type { TaskSortMode } from "@/constants/tasks";
import type { Task } from "@/types/tasks";

export function sortTasksByMode(tasks: Task[], mode: TaskSortMode) {
	return [...tasks].sort((a, b) => {
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
