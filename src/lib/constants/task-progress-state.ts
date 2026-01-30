/**
 * Task Progress States - Derived from task data for UI display
 *
 * These are NOT persisted in the database. They are computed from:
 * - task.status (pending | in_execution | executed)
 * - subtask completion counts
 * - task description presence
 * - AI metadata (last completed action)
 */

export const TASK_PROGRESS_STATES = [
	"in-execution",
	"ready-to-start",
	"ready-to-review",
	"ready-to-commit",
	"ai-working",
	"started",
	"idle",
	"done",
] as const;

export type TaskProgressState = (typeof TASK_PROGRESS_STATES)[number];

/**
 * Labels in Portuguese
 */
export const PROGRESS_STATE_LABELS: Record<TaskProgressState, string> = {
	"in-execution": "Em execução",
	"ready-to-start": "Pronta",
	"ready-to-review": "Aguardando revisão",
	"ready-to-commit": "Pronta para commit",
	"ai-working": "IA trabalhando",
	started: "Iniciada",
	idle: "Pendente",
	done: "Concluída",
};

/**
 * Priority rank for ordering (lower = higher priority = more attention needed)
 */
export const PROGRESS_STATE_PRIORITY: Record<TaskProgressState, number> = {
	"in-execution": 1,
	"ready-to-start": 2,
	"ready-to-review": 3,
	"ready-to-commit": 4,
	"ai-working": 5,
	started: 6,
	idle: 7,
	done: 8,
};

/**
 * Visual styling colors for each progress state (hex)
 */
export const PROGRESS_STATE_COLORS: Record<TaskProgressState, string> = {
	"in-execution": "#b33a3a",
	"ready-to-start": "#4a8ec2",
	"ready-to-review": "#c9a227",
	"ready-to-commit": "#6c5ce7",
	"ai-working": "#2a9d8f",
	started: "#c2722a",
	idle: "#7a7a7a",
	done: "#4a4a4a",
};

/**
 * Container classes for task list items (background + border + hover)
 */
export const PROGRESS_STATE_CONTAINER_CLASSES: Record<TaskProgressState, string> = {
	"in-execution": "bg-[#b33a3a]/10 ring-1 ring-[#b33a3a] hover:bg-[#b33a3a]/15",
	"ready-to-start": "bg-[#4a8ec2]/10 hover:bg-[#4a8ec2]/15",
	"ready-to-review": "bg-[#c9a227]/15 ring-1 ring-[#c9a227] hover:bg-[#c9a227]/20",
	"ready-to-commit": "bg-[#6c5ce7]/10 ring-1 ring-[#6c5ce7] hover:bg-[#6c5ce7]/15",
	"ai-working": "bg-[#2a9d8f]/10 ring-1 ring-[#2a9d8f] animate-pulse",
	started: "bg-card hover:bg-secondary",
	idle: "bg-card hover:bg-secondary",
	done: "bg-card hover:bg-secondary opacity-60",
};

/**
 * Icon indicators for visual cues
 */
export const PROGRESS_STATE_INDICATORS: Record<
	TaskProgressState,
	"spinner" | "check" | "dot" | "none"
> = {
	"in-execution": "dot",
	"ready-to-start": "dot",
	"ready-to-review": "check",
	"ready-to-commit": "check",
	"ai-working": "spinner",
	started: "dot",
	idle: "none",
	done: "check",
};

/**
 * Section grouping for task list display
 */
export type ProgressStateSection = "attention" | "waiting" | "setup" | "done";

export const PROGRESS_STATE_SECTIONS: Record<TaskProgressState, ProgressStateSection> = {
	"in-execution": "attention",
	"ready-to-start": "attention",
	"ready-to-review": "attention",
	"ready-to-commit": "attention",
	"ai-working": "waiting",
	started: "setup",
	idle: "setup",
	done: "done",
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getProgressStateLabel(state: TaskProgressState): string {
	return PROGRESS_STATE_LABELS[state];
}

export function getProgressStateColor(state: TaskProgressState): string {
	return PROGRESS_STATE_COLORS[state];
}

export function getProgressStateContainerClass(state: TaskProgressState): string {
	return PROGRESS_STATE_CONTAINER_CLASSES[state];
}

export function getProgressStateIndicator(state: TaskProgressState) {
	return PROGRESS_STATE_INDICATORS[state];
}

export function getProgressStatePriority(state: TaskProgressState): number {
	return PROGRESS_STATE_PRIORITY[state];
}

export function getProgressStateSection(state: TaskProgressState): ProgressStateSection {
	return PROGRESS_STATE_SECTIONS[state];
}

export function getProgressStateFilterOptions() {
	return TASK_PROGRESS_STATES.map((state) => ({
		value: state,
		label: PROGRESS_STATE_LABELS[state],
	}));
}

export function requiresUserAttention(state: TaskProgressState): boolean {
	return PROGRESS_STATE_SECTIONS[state] === "attention";
}

export function isAiWorking(state: TaskProgressState): boolean {
	return state === "ai-working";
}

export function isCompleted(state: TaskProgressState): boolean {
	return state === "done";
}
