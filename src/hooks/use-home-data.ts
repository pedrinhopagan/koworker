import { orpc, type RouterOutputs } from "@/client";
import { useProjectFocus } from "@/hooks";
import { useQuery } from "@tanstack/react-query";

export type Project = RouterOutputs["projects"]["list"][number];

export const MAX_VISIBLE_TASKS = 5;

export function useHomeData() {
	const { projects, selectedProjectId, loading: projectsLoading } = useProjectFocus();

	const tasksQuery = useQuery({
		...orpc.tasks.getAll.queryOptions({ input: { projectId: selectedProjectId ?? null } }),
	});

	return {
		tasks: tasksQuery.data ?? [],
		projects,
		loading: projectsLoading || tasksQuery.isLoading,
	};
}
