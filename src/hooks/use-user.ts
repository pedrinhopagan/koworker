import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpc } from "@/client";

export function useUser() {
	const queryClient = useQueryClient();
	const userQuery = orpc.auth.me.queryOptions();
	const cachedUser = queryClient.getQueryData(userQuery.queryKey);
	const userQueryResult = useQuery({
		...userQuery,
		enabled: !cachedUser,
	});

	const user = userQueryResult.data ?? cachedUser ?? null;

	useEffect(() => {
		if (!user) return;

		const projectsQuery = orpc.projects.list.queryOptions();
		const cachedProjects = queryClient.getQueryData(projectsQuery.queryKey);

		if (!cachedProjects) {
			void queryClient.ensureQueryData(projectsQuery);
		}
	}, [queryClient, user]);

	return {
		user,
		loading: userQueryResult.isLoading && !cachedUser,
	};
}
