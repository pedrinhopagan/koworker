import { useQuery } from "@tanstack/react-query";
import { orpc, type RouterOutputs } from "@/client";
import { useProjectFocus } from "@/hooks";

export type Project = RouterOutputs["projects"]["overview"][number];
export type ProjectDetail = RouterOutputs["projects"]["getById"];

export function useProjectsData(preferredProjectId?: string | null) {
	const { selectedProjectId, loading } = useProjectFocus({
		preferredProjectId: preferredProjectId ?? null,
	});
	const overviewQuery = useQuery(orpc.projects.overview.queryOptions());
	const projects = overviewQuery.data ?? [];

	const projectIdForQuery = selectedProjectId ?? null;

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
			selectedProject: projectQuery.data ?? null,
		},
		loading: loading || overviewQuery.isLoading || projectQuery.isLoading,
	};
}
