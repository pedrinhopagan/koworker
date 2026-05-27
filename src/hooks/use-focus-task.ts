import { useQuery } from "@tanstack/react-query";
import { orpc, type RouterOutputs } from "@/client";
import { useProjectFocus } from "./use-project-focus";

export type FocusTask = NonNullable<RouterOutputs["tasks"]["focus"]>;

export function useFocusTask(projectId?: string | null) {
	const { selectedProjectId } = useProjectFocus();
	const resolvedProjectId = projectId ?? selectedProjectId ?? null;
	const { data: task, isLoading } = useQuery(
		orpc.tasks.focus.queryOptions({
			input: { projectId: resolvedProjectId },
		}),
	);

	return {
		task: task ?? null,
		isLoading,
	};
}
