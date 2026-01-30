import { useMemo } from "react";

import {
	type ActionDefinition,
	type ActionTaskContext,
	getSuggestedAction,
} from "@/lib/constants/action-registry";
import {
	type TaskProgressState,
	getProgressStateColor,
	getProgressStateLabel,
} from "@/lib/constants/task-progress-state";

// ============================================================================
// Progress State Derivation
// ============================================================================

/**
 * Derive the progress state from task data.
 *
 * States are computed based on:
 * - task.status (pending | in_execution | executed)
 * - subtask completion counts
 * - task description presence
 * - AI metadata (lastCompletedAction)
 */
export function deriveProgressState(task: ActionTaskContext): TaskProgressState {
	const { status, subtasks = [], context, aiMetadata } = task;

	// Task is done
	if (status === "executed") {
		return "done";
	}

	const subtaskCount = subtasks.length;
	const doneCount = subtasks.filter((s) => s.status === "done" || s.status === "executed").length;
	const inProgressCount = subtasks.filter((s) => s.status === "in_progress").length;
	const hasDescription = Boolean(context?.description);
	const lastAction = aiMetadata?.lastCompletedAction;

	// AI is currently working (task marked as in_execution)
	if (status === "in_execution") {
		return "ai-working";
	}

	// All subtasks done - check if ready for commit or review
	if (subtaskCount > 0 && doneCount === subtaskCount) {
		if (lastAction === "review") {
			return "ready-to-commit";
		}
		return "ready-to-review";
	}

	// Some subtasks are in progress or partially done
	if (subtaskCount > 0 && (inProgressCount > 0 || doneCount > 0)) {
		return "in-execution";
	}

	// Has subtasks but none started yet - ready to execute
	if (subtaskCount > 0 && doneCount === 0) {
		return "ready-to-start";
	}

	// No subtasks yet - check if task has been started (has description)
	if (hasDescription || lastAction === "structure") {
		return "started";
	}

	// Fresh task with nothing done yet
	return "idle";
}

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

		const progressState = deriveProgressState(task);
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
