import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc, type RouterOutputs } from "@/client";
import { useProjectFocus } from "./use-project-focus";

export type FocusTask = NonNullable<RouterOutputs["tasks"]["focus"]>;
export type FocusSubtask = NonNullable<FocusTask["subtasks"]>[number];

export function useFocusTask(projectId?: string | null) {
	const { selectedProjectId } = useProjectFocus();
	const resolvedProjectId = projectId ?? selectedProjectId ?? null;
	const { data: task, isLoading } = useQuery(
		orpc.tasks.focus.queryOptions({
			input: { projectId: resolvedProjectId },
		}),
	);

	const subtasks = useMemo(() => task?.subtasks ?? [], [task?.subtasks]);

	const progress = useMemo(() => {
		if (subtasks.length === 0) return 0;
		const completed = subtasks.filter((s) => s.status === "executed").length;
		return Math.round((completed / subtasks.length) * 100);
	}, [subtasks]);

	return {
		task: task ?? null,
		isLoading,
		subtasks,
		progress,
	};
}
