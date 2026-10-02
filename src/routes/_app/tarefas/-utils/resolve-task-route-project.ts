import type { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/client";
import { isTaskIdSegment, NO_FEATURE_ROUTE_ID } from "./task-route-resolution";

export async function resolveTaskRouteProject({
	queryClient,
	firstSegment,
	secondSegment,
	projectId,
}: {
	queryClient: QueryClient;
	firstSegment: string;
	secondSegment?: string;
	projectId?: string;
}) {
	if (firstSegment === NO_FEATURE_ROUTE_ID && !secondSegment) {
		return projectId;
	}

	const taskId = secondSegment && isTaskIdSegment(secondSegment) ? secondSegment : firstSegment;
	const task = await queryClient.fetchQuery(
		orpc.tasks.getFull.queryOptions({ input: { id: taskId } }),
	);

	if (task) {
		return task.projectId;
	}

	if (secondSegment) {
		return;
	}

	const groups = await queryClient.fetchQuery(orpc.taskGroups.list.queryOptions({ input: {} }));

	return groups.find((group) => group.id === firstSegment)?.projectId;
}
