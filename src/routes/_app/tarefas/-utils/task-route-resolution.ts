export const NO_FEATURE_ROUTE_ID = "sem-feature";

export function taskFeatureRouteId(groupId: string | null | undefined) {
	return groupId || NO_FEATURE_ROUTE_ID;
}

export function taskMatchesFeature(
	task: { projectId: string; groupId?: string },
	input: { featureId: string; projectId?: string },
) {
	if (input.projectId && task.projectId !== input.projectId) return false;
	if (input.featureId === NO_FEATURE_ROUTE_ID) return !task.groupId;
	return task.groupId === input.featureId;
}

export function canonicalTaskRoute(task: { id: string; groupId?: string }) {
	return {
		featureId: taskFeatureRouteId(task.groupId),
		taskId: task.id,
	};
}
