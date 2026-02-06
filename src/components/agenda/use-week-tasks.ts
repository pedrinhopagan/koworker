import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useTasksData } from "@/hooks/use-tasks-data";
import type { TaskWithMeta } from "@/types/tasks";

export type TasksByDate = Map<string, TaskWithMeta[]>;

export function useWeekTasks(startDate: string, endDate: string) {
	const queryClient = useQueryClient();
	const { data, loading } = useTasksData({ includeCompleted: false });

	const tasks: TaskWithMeta[] = useMemo(
		() =>
			data.tasks.filter((task) => {
				if (!task.scheduledDate) return false;
				return task.scheduledDate >= startDate && task.scheduledDate <= endDate;
			}),
		[data.tasks, startDate, endDate],
	);

	const tasksByDate: TasksByDate = useMemo(() => {
		const map = new Map<string, TaskWithMeta[]>();
		for (const task of tasks) {
			if (task.scheduledDate) {
				const existing = map.get(task.scheduledDate) ?? [];
				existing.push(task);
				map.set(task.scheduledDate, existing);
			}
		}

		for (const [date, list] of map.entries()) {
			map.set(
				date,
				list.sort((a, b) => {
					const timeCompare = (a.scheduledTime ?? "00:00").localeCompare(
						b.scheduledTime ?? "00:00",
					);
					if (timeCompare !== 0) return timeCompare;
					return a.title.localeCompare(b.title);
				}),
			);
		}

		return map;
	}, [tasks]);

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
