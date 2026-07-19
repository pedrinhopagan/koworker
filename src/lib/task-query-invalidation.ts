import type { Query, QueryClient } from "@tanstack/react-query";

export type TaskQueryInvalidation = {
	taskId?: string;
	projectId: string | null | undefined;
};

const projectTaskProcedures = new Set(["getAll", "listByProject", "metrics", "focus"]);
const detailTaskProcedures = new Set(["getById", "getFull"]);

function matchesProject(
	projectId: string | null | undefined,
	eventProjectId: string | null | undefined,
) {
	return !projectId || !eventProjectId || projectId === eventProjectId;
}

export function shouldInvalidateTaskQuery(query: Query, event: TaskQueryInvalidation) {
	const path = Array.isArray(query.queryKey[0]) ? query.queryKey[0] : [];
	const [root, procedure] = path;
	const input = (
		query.queryKey[1] as { input?: { id?: string; projectId?: string | null } } | undefined
	)?.input;

	if (root === "tasks" && typeof procedure === "string") {
		if (projectTaskProcedures.has(procedure)) {
			return matchesProject(input?.projectId, event.projectId);
		}

		if (detailTaskProcedures.has(procedure)) {
			if (event.taskId) return input?.id === event.taskId;
			const data = query.state.data as { projectId?: string } | null | undefined;
			return event.projectId ? data?.projectId === event.projectId : true;
		}

		return false;
	}

	if (root === "vault" && procedure === "listEntries") {
		return matchesProject(input?.projectId, event.projectId);
	}

	if (root === "mostruario" && procedure === "list") {
		return matchesProject(input?.projectId, event.projectId);
	}

	if (root === "media" && procedure === "list") {
		return matchesProject(input?.projectId, event.projectId);
	}

	return false;
}

export function invalidateTaskQueries(queryClient: QueryClient, event: TaskQueryInvalidation) {
	return queryClient.invalidateQueries(
		{ predicate: (query) => shouldInvalidateTaskQuery(query, event) },
		{ cancelRefetch: false },
	);
}
