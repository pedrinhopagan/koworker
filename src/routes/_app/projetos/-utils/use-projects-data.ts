import { useQuery } from "@tanstack/react-query";

import { orpc, type RouterOutputs } from "@/client";

export type Project = RouterOutputs["projects"]["list"][number];

export function useProjectsData() {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());

	const projects = projectsQuery.data ?? [];

	return {
		data: {
			projects,
			total: projects.length,
		},
		loading: projectsQuery.isLoading,
	};
}
