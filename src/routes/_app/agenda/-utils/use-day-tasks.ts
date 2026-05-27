import { useQueryClient } from "@tanstack/react-query";

import { useTasksData } from "@/hooks/use-tasks-data";
import type { TaskWithMeta } from "@/types/tasks";

export function useDayTasks(date: string | null) {
	const queryClient = useQueryClient();
	const { data, loading } = useTasksData({ includeCompleted: false });

	const tasks: TaskWithMeta[] = data.tasks
		.filter((task) => task.scheduledDate === date)
		.sort((a, b) => {
			const timeCompare = (a.scheduledTime ?? "00:00").localeCompare(b.scheduledTime ?? "00:00");
			if (timeCompare !== 0) return timeCompare;
			return a.displayTitle.localeCompare(b.displayTitle);
		});

	const refetch = () => {
		queryClient.invalidateQueries({ queryKey: ["tasks"] });
	};

	return {
		tasks,
		loading,
		refetch,
	};
}
