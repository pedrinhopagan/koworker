/**
 * Task Status Constants
 *
 * Status values persisted in the database.
 * Visual styling and labels for TaskStatusSelect component.
 */

export const TASK_STATUSES = ["pending", "in_execution", "executed"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Labels in Portuguese
 */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
	pending: "Pendente",
	in_execution: "Em execução",
	executed: "Executada",
};

/**
 * Colors for each status (hex values)
 */
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
	pending: "#7a7a7a",
	in_execution: "#c2722a",
	executed: "#4a9d6a",
};

/**
 * Icon indicator types for visual cues
 */
export const TASK_STATUS_INDICATORS: Record<TaskStatus, "dot" | "spinner" | "check"> = {
	pending: "dot",
	in_execution: "spinner",
	executed: "check",
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getTaskStatusLabel(status: TaskStatus): string {
	return TASK_STATUS_LABELS[status];
}

export function getTaskStatusColor(status: TaskStatus): string {
	return TASK_STATUS_COLORS[status];
}

export function getTaskStatusIndicator(status: TaskStatus) {
	return TASK_STATUS_INDICATORS[status];
}

export function isValidTaskStatus(value: string): value is TaskStatus {
	return TASK_STATUSES.includes(value as TaskStatus);
}

/**
 * Get status options for select components
 */
export function getTaskStatusOptions() {
	return TASK_STATUSES.map((status) => ({
		id: status,
		label: TASK_STATUS_LABELS[status],
		color: TASK_STATUS_COLORS[status],
	}));
}
