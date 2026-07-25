export const NO_FEATURE_ROUTE_ID = "sem-feature";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTaskIdSegment(segment: string) {
	return UUID_PATTERN.test(segment);
}

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
