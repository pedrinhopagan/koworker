import { useMemo } from "react";

import { useTasksData } from "@/hooks/use-tasks-data";

export function useAgendaSidebarTasks() {
	const { data, loading } = useTasksData({ includeCompleted: false });

	const tasks = data.tasks;

	const unscheduledTasks = useMemo(() => tasks.filter((task) => !task.scheduledDate), [tasks]);

	const scheduledTasks = useMemo(
		() =>
			tasks
				.filter((task) => Boolean(task.scheduledDate))
				.sort((a, b) => {
					const dateCompare = (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "");
					if (dateCompare !== 0) return dateCompare;

					const timeA = a.scheduledTime ?? "00:00";
					const timeB = b.scheduledTime ?? "00:00";
					return timeA.localeCompare(timeB);
				}),
		[tasks],
	);

	return {
		loading,
		unscheduledTasks,
		scheduledTasks,
	};
}
