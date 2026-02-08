import type { QueryClient } from "@tanstack/react-query";

export function invalidateSubtasksQueries(queryClient: QueryClient) {
	queryClient.invalidateQueries({
		predicate: (query) => Array.isArray(query.queryKey?.[0]) && query.queryKey[0][0] === "tasks",
	});
	queryClient.invalidateQueries({
		predicate: (query) => Array.isArray(query.queryKey?.[0]) && query.queryKey[0][0] === "subtasks",
	});
}
