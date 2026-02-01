import { useQuery } from "@tanstack/react-query";
import { orpc, type RouterOutputs } from "@/client";
import { useProjectFocus } from "@/hooks";

export type Project = RouterOutputs["projects"]["list"][number];
export type ProjectDetail = RouterOutputs["projects"]["getById"];

export function useProjectsData(preferredProjectId?: string | null) {
	const { projects, selectedProjectId, selectedProject, loading } = useProjectFocus({
		preferredProjectId: preferredProjectId ?? null,
	});

	const projectIdForQuery = preferredProjectId ?? selectedProjectId ?? null;

	const projectQuery = useQuery({
		...orpc.projects.getById.queryOptions({
			input: { id: projectIdForQuery ?? "" },
		}),
		enabled: Boolean(projectIdForQuery),
	});

	return {
		data: {
			projects,
			total: projects.length,
			selectedProjectId,
			selectedProject: projectQuery.data ?? selectedProject ?? null,
		},
		loading: loading || projectQuery.isLoading,
	};
}
