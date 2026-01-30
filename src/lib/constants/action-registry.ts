/**
 * Action Registry - Defines all flow actions for task execution
 *
 * Actions: Structure, Execute All, Execute Subtask, Review, Commit, Focus Terminal
 * Each action has icon, color, suggestion logic, and prompt generation.
 */

import {
	FileCheck,
	FileText,
	GitCommitHorizontal,
	Monitor,
	Rocket,
	Target,
	type LucideIcon,
} from "lucide-react";

import type { TaskProgressState } from "./task-progress-state";
import { PROGRESS_STATE_COLORS } from "./task-progress-state";

// ============================================================================
// Types
// ============================================================================

export type ActionId =
	| "structure"
	| "execute_all"
	| "execute_subtask"
	| "review"
	| "commit"
	| "focus_terminal";

/**
 * Minimal task info needed for action logic
 * Compatible with TaskWithMeta and future TaskFull types
 */
export interface ActionTaskContext {
	id: string;
	title: string;
	status: string;
	subtasks?: Array<{ id: string; title: string; status: string; order: number }>;
	context?: { description?: string | null };
	aiMetadata?: { lastCompletedAction?: string | null };
}

export interface ActionDefinition {
	id: ActionId;
	label: string;
	icon: LucideIcon;
	skill: string;
	color: string;
	suggestedWhen: (task: ActionTaskContext, progressState: TaskProgressState) => boolean;
	generatePrompt: (task: ActionTaskContext, subtaskId?: string) => string;
	requiresSubtaskSelect?: boolean;
}

// ============================================================================
// Action Colors (derived from progress states)
// ============================================================================

const ACTION_COLORS: Record<ActionId, string> = {
	structure: PROGRESS_STATE_COLORS["started"],
	execute_all: PROGRESS_STATE_COLORS["ready-to-start"],
	execute_subtask: PROGRESS_STATE_COLORS["in-execution"],
	review: PROGRESS_STATE_COLORS["ready-to-review"],
	commit: PROGRESS_STATE_COLORS["ready-to-commit"],
	focus_terminal: PROGRESS_STATE_COLORS["ai-working"],
};

// ============================================================================
// Action Definitions
// ============================================================================

const focusTerminal: ActionDefinition = {
	id: "focus_terminal",
	label: "Ver terminal",
	icon: Monitor,
	skill: "",
	color: ACTION_COLORS.focus_terminal,
	suggestedWhen: (_, progressState) => progressState === "ai-working",
	generatePrompt: () => "",
};

const commit: ActionDefinition = {
	id: "commit",
	label: "Commit",
	icon: GitCommitHorizontal,
	skill: "workopilot-commit",
	color: ACTION_COLORS.commit,
	suggestedWhen: (task, progressState) => {
		if (progressState !== "ready-to-commit") return false;
		const subtasks = task.subtasks ?? [];
		const subtaskCount = subtasks.length;
		const doneCount = subtasks.filter((s) => s.status === "done").length;
		const allDone = subtaskCount > 0 && doneCount === subtaskCount;
		const lastAction = task.aiMetadata?.lastCompletedAction;
		return allDone && lastAction === "review" && task.status !== "executed";
	},
	generatePrompt: (task) =>
		`Commit: ${task.title}, utilize a skill workopilot-commit para commitar as mudanças da task de id: ${task.id}`,
};

const review: ActionDefinition = {
	id: "review",
	label: "Revisar",
	icon: FileCheck,
	skill: "workopilot-review",
	color: ACTION_COLORS.review,
	suggestedWhen: (_, progressState) => progressState === "ready-to-review",
	generatePrompt: (task) =>
		`Revisar: ${task.title}, utilize a skill workopilot-review para revisar a task de id: ${task.id}`,
};

const executeSubtask: ActionDefinition = {
	id: "execute_subtask",
	label: "Executar Subtask",
	icon: Target,
	skill: "workopilot-execute-subtask",
	color: ACTION_COLORS.execute_subtask,
	suggestedWhen: (task, progressState) => {
		if (progressState === "in-execution") return true;
		if (progressState === "ready-to-start") {
			const subtaskCount = task.subtasks?.length ?? 0;
			return subtaskCount > 3;
		}
		return false;
	},
	generatePrompt: (task, subtaskId?: string) => {
		const subtask = task.subtasks?.find((s) => s.id === subtaskId);
		const subtaskTitle = subtask?.title ?? "subtask";
		return `Executar subtask: ${subtaskTitle} (task: ${task.title}), utilize a skill workopilot-execute-subtask para executar a subtask ${subtaskId} da task ${task.id}`;
	},
	requiresSubtaskSelect: true,
};

const executeAll: ActionDefinition = {
	id: "execute_all",
	label: "Executar Tudo",
	icon: Rocket,
	skill: "workopilot-execute-all",
	color: ACTION_COLORS.execute_all,
	suggestedWhen: (task, progressState) => {
		if (progressState !== "ready-to-start") return false;
		const subtaskCount = task.subtasks?.length ?? 0;
		return subtaskCount <= 3;
	},
	generatePrompt: (task) =>
		`Executar: ${task.title}, utilize a skill workopilot-execute-all para executar a task de id: ${task.id}`,
};

const structure: ActionDefinition = {
	id: "structure",
	label: "Estruturar",
	icon: FileText,
	skill: "workopilot-structure",
	color: ACTION_COLORS.structure,
	suggestedWhen: (_, progressState) => progressState === "idle" || progressState === "started",
	generatePrompt: (task) =>
		`Estruturar: ${task.title}, utilize a skill workopilot-structure para estruturar a task de id: ${task.id}`,
};

// ============================================================================
// Registry
// ============================================================================

/**
 * Actions ordered by suggestion priority (first match wins):
 * 1. focus_terminal - AI is active, highest priority
 * 2. commit - subset of review condition (more specific)
 * 3. review - all subtasks done
 * 4. execute_subtask - in-execution or ready-to-start with many subtasks
 * 5. execute_all - ready-to-start with few subtasks
 * 6. structure - idle/started, least progressed
 */
export const ACTIONS: ActionDefinition[] = [
	focusTerminal,
	commit,
	review,
	executeSubtask,
	executeAll,
	structure,
];

/**
 * Actions that appear in the toolbar (excludes focus_terminal)
 */
export const TOOLBAR_ACTIONS: ActionDefinition[] = [
	structure,
	executeAll,
	executeSubtask,
	review,
	commit,
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getActionById(id: string): ActionDefinition | undefined {
	return ACTIONS.find((action) => action.id === id);
}

export function getSuggestedAction(
	task: ActionTaskContext | null,
	progressState: TaskProgressState,
): ActionDefinition | null {
	if (!task) return null;
	return ACTIONS.find((action) => action.suggestedWhen(task, progressState)) ?? null;
}

export function getActionColor(id: ActionId): string {
	return ACTION_COLORS[id];
}

export function getActionLabel(id: ActionId): string {
	const action = getActionById(id);
	return action?.label ?? id;
}
