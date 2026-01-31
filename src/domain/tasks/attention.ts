import {
	getProgressStateColor,
	getProgressStateLabel,
	getProgressStatePriority,
	getProgressStateSection,
	requiresUserAttention,
	type TaskProgressState,
} from "@/lib/constants/task-progress-state";

// ============================================================================
// Types
// ============================================================================

type SubtaskLike = {
	status?: string | null;
};

export type TaskAttentionSeverity = "none" | "low" | "medium" | "high";

/**
 * Minimal task shape needed to derive attention/progress.
 *
 * This is intentionally decoupled from API/router types to keep the function pure
 * and easy to test.
 */
export type TaskAttentionInput = {
	status: "pending" | "in_execution" | "executed" | string;
	description?: string | null;
	aiMetadata?: { lastCompletedAction?: string | null } | null;
	subtasks?: SubtaskLike[] | null;
};

export type TaskAttentionState = {
	/** Canonical derived state used across the UI */
	progressState: TaskProgressState;
	/** Localized label for quick display */
	label: string;
	/** Hex color associated with the derived state */
	color: string;
	/** Whether this item should be treated as needing user attention */
	requiresAttention: boolean;
	/** Section used for grouping/filtering */
	section: ReturnType<typeof getProgressStateSection>;
	/** Priority rank (lower = more urgent) */
	priority: number;

	// UI hints
	shouldPulse: boolean;
	shouldSpin: boolean;
	severity: TaskAttentionSeverity;
};

// ============================================================================
// Progress derivation (pure)
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
export function deriveProgressState(task: TaskAttentionInput): TaskProgressState {
	const { status, subtasks = [], description, aiMetadata } = task;

	// Task is done
	if (status === "executed") {
		return "done";
	}

	const subtaskList = subtasks ?? [];
	const subtaskCount = subtaskList.length;
	const doneCount = subtaskList.filter(
		(s) => s.status === "done" || s.status === "executed",
	).length;
	const inProgressCount = subtaskList.filter((s) => s.status === "in_progress").length;
	const hasDescription = Boolean(description);
	const lastAction = aiMetadata?.lastCompletedAction ?? null;

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
// Attention derivation (pure)
// ============================================================================

function deriveSeverity(progressState: TaskProgressState): TaskAttentionSeverity {
	// Severity is a simplified signal for UI; keep it stable and predictable.
	switch (progressState) {
		case "done":
			return "none";
		case "idle":
		case "started":
			return "low";
		case "ai-working":
			return "medium";
		case "ready-to-start":
			return "medium";
		case "ready-to-review":
		case "ready-to-commit":
		case "in-execution":
			return "high";
		default:
			return "low";
	}
}

/**
 * Central function to derive a normalized "attention" state for a task.
 *
 * It returns:
 * - canonical derived progress state
 * - severity + small UI hints (pulse/spin)
 * - label/color/priority/section for consistent rendering
 */
export function deriveTaskAttentionState(task: TaskAttentionInput): TaskAttentionState {
	const progressState = deriveProgressState(task);
	const label = getProgressStateLabel(progressState);
	const color = getProgressStateColor(progressState);
	const priority = getProgressStatePriority(progressState);
	const section = getProgressStateSection(progressState);
	const requiresAttention = requiresUserAttention(progressState);

	// UI hints (kept conservative; can be expanded later)
	const shouldSpin = progressState === "ai-working";
	const shouldPulse =
		progressState === "ready-to-start" ||
		progressState === "ready-to-review" ||
		progressState === "ready-to-commit";

	return {
		progressState,
		label,
		color,
		priority,
		section,
		requiresAttention,
		shouldPulse,
		shouldSpin,
		severity: deriveSeverity(progressState),
	};
}
