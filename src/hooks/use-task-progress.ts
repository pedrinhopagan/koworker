import { useMemo } from "react";
import { deriveProgressState } from "@/domain/tasks/attention";
import {
	type ActionDefinition,
	type ActionTaskContext,
	getSuggestedAction,
} from "@/lib/constants/action-registry";
import {
	getProgressStateColor,
	getProgressStateLabel,
	type TaskProgressState,
} from "@/lib/constants/task-progress-state";

// ============================================================================
// Hook
// ============================================================================

export interface UseTaskProgressResult {
	/** Computed progress state */
	progressState: TaskProgressState;
	/** Localized label for the state */
	label: string;
	/** Hex color for the state */
	color: string;
	/** Suggested next action based on current state */
	suggestedAction: ActionDefinition | null;
}

/**
 * Hook to compute task progress state and related UI data.
 *
 * @param task - Task context or null
 * @returns Progress state, label, color, and suggested action
 *
 * @example
 * ```tsx
 * const { progressState, label, color, suggestedAction } = useTaskProgress(task);
 * ```
 */
export function useTaskProgress(task: ActionTaskContext | null): UseTaskProgressResult {
	return useMemo(() => {
		if (!task) {
			return {
				progressState: "idle" as TaskProgressState,
				label: getProgressStateLabel("idle"),
				color: getProgressStateColor("idle"),
				suggestedAction: null,
			};
		}

		const progressState = deriveProgressState({
			status: task.status,
			description: task.context?.description,
			aiMetadata: task.aiMetadata,
			subtasks: task.subtasks,
		});
		const label = getProgressStateLabel(progressState);
		const color = getProgressStateColor(progressState);
		const suggestedAction = getSuggestedAction(task, progressState);

		return {
			progressState,
			label,
			color,
			suggestedAction,
		};
	}, [task]);
}
