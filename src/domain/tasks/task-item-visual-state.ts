import type { BadgeVariant } from "@/components/ui/badge";
import { getStatusLabel, getStatusVariant } from "@/domain/tasks/status";
import { PROGRESS_STATE_COLORS } from "@/lib/constants/task-progress-state";

type SubtaskLike = {
	status?: string | null;
};

type CriterionLike = {
	done?: boolean;
};

export type TaskItemVisualState =
	| "in-execution"
	| "ready-to-start"
	| "ready-to-review"
	| "ready-to-commit"
	| "started"
	| "idle"
	| "done";

type TaskItemIndicator = "spinner" | "check" | "dot" | "none";

type TaskItemVisualInput = {
	status: string;
	description?: string | null;
	aiMetadata?: { lastCompletedAction?: string | null } | null;
	subtasks?: SubtaskLike[] | null;
	acceptanceCriteria?: CriterionLike[] | null;
	completedAt?: number | null;
};

type VisualStatePresentation = {
	label: string;
	color: string;
	badgeVariant: BadgeVariant;
	indicator: TaskItemIndicator;
	shouldPulse: boolean;
	requiresAttention: boolean;
};

export type TaskItemStatusPresentation = VisualStatePresentation & {
	state: TaskItemVisualState;
	isFallback: boolean;
};

const VISUAL_STATE_PRESENTATION: Record<TaskItemVisualState, VisualStatePresentation> = {
	"in-execution": {
		label: "Em andamento",
		color: PROGRESS_STATE_COLORS["ai-working"],
		badgeVariant: "warning",
		indicator: "spinner",
		shouldPulse: true,
		requiresAttention: true,
	},
	"ready-to-start": {
		label: "Pronta",
		color: PROGRESS_STATE_COLORS["ready-to-start"],
		badgeVariant: "warning",
		indicator: "dot",
		shouldPulse: true,
		requiresAttention: true,
	},
	"ready-to-review": {
		label: "Aguardando revisão",
		color: PROGRESS_STATE_COLORS["ready-to-review"],
		badgeVariant: "warning",
		indicator: "check",
		shouldPulse: true,
		requiresAttention: true,
	},
	"ready-to-commit": {
		label: "Pronta para commit",
		color: PROGRESS_STATE_COLORS["ready-to-commit"],
		badgeVariant: "success",
		indicator: "check",
		shouldPulse: false,
		requiresAttention: true,
	},
	started: {
		label: "Iniciada",
		color: PROGRESS_STATE_COLORS.started,
		badgeVariant: "muted",
		indicator: "dot",
		shouldPulse: false,
		requiresAttention: false,
	},
	idle: {
		label: "Pendente",
		color: PROGRESS_STATE_COLORS.idle,
		badgeVariant: "muted",
		indicator: "none",
		shouldPulse: false,
		requiresAttention: false,
	},
	done: {
		label: "Concluída",
		color: PROGRESS_STATE_COLORS.done,
		badgeVariant: "success",
		indicator: "check",
		shouldPulse: false,
		requiresAttention: false,
	},
};

function normalizeSubtaskStatus(status: unknown): "pending" | "in_execution" | "executed" {
	switch (status) {
		case "done":
			return "executed";
		case "in_progress":
			return "in_execution";
		case "pending":
		case "in_execution":
		case "executed":
			return status;
		default:
			return "pending";
	}
}

function mapStatusToVisualState(status: string): TaskItemVisualState {
	if (status === "in_execution") return "in-execution";
	if (status === "executed") return "done";
	return "idle";
}

function shouldUseStatusFallback(input: TaskItemVisualInput): boolean {
	const hasDescription = Boolean(input.description);
	const hasLastAction = Boolean(input.aiMetadata?.lastCompletedAction);
	const hasSubtasks = Boolean(input.subtasks?.length);
	const hasCriteria = Boolean(input.acceptanceCriteria?.length);
	const hasCompletion = Boolean(input.completedAt);
	const isInExecution = input.status === "in_execution";

	return (
		!hasDescription &&
		!hasLastAction &&
		!hasSubtasks &&
		!hasCriteria &&
		!hasCompletion &&
		!isInExecution
	);
}

export function deriveTaskItemVisualState(input: TaskItemVisualInput): TaskItemVisualState {
	if (input.completedAt) {
		return "done";
	}

	const subtasks = input.subtasks ?? [];
	const criteria = input.acceptanceCriteria ?? [];
	const subtaskTotal = subtasks.length;
	const subtaskDone = subtasks.filter(
		(st) => normalizeSubtaskStatus(st.status) === "executed",
	).length;
	const hasSubtaskInExecution = subtasks.some(
		(st) => normalizeSubtaskStatus(st.status) === "in_execution",
	);
	const criteriaTotal = criteria.length;
	const criteriaDone = criteria.filter((c) => Boolean(c.done)).length;
	const hasDescription = Boolean(input.description);
	const lastAction = input.aiMetadata?.lastCompletedAction;

	if (input.status === "in_execution" || hasSubtaskInExecution) {
		return "in-execution";
	}

	if (subtaskTotal > 0 && subtaskDone === subtaskTotal) {
		if (criteriaTotal > 0 && criteriaDone < criteriaTotal) {
			return "ready-to-review";
		}
		if (
			input.status === "executed" ||
			(criteriaTotal > 0 && criteriaDone === criteriaTotal) ||
			lastAction === "review_execution" ||
			lastAction === "review"
		) {
			return "ready-to-commit";
		}
		return "ready-to-review";
	}

	if (subtaskTotal > 0 && subtaskDone > 0) {
		return "in-execution";
	}

	if (subtaskTotal > 0) {
		return "ready-to-start";
	}

	if (criteriaTotal > 0 && criteriaDone < criteriaTotal) {
		return "ready-to-review";
	}

	if (criteriaTotal > 0 && criteriaDone === criteriaTotal) {
		return "ready-to-commit";
	}

	if (hasDescription || lastAction === "structure") {
		return "started";
	}

	if (input.status === "executed") {
		return "done";
	}

	return "idle";
}

export function getTaskItemStatusPresentation(
	input: TaskItemVisualInput,
): TaskItemStatusPresentation {
	if (shouldUseStatusFallback(input)) {
		const state = mapStatusToVisualState(input.status);
		const fallbackColor =
			state === "in-execution"
				? PROGRESS_STATE_COLORS["ai-working"]
				: state === "done"
					? PROGRESS_STATE_COLORS.done
					: PROGRESS_STATE_COLORS.idle;
		const fallbackIndicator: TaskItemIndicator =
			state === "in-execution" ? "spinner" : state === "done" ? "check" : "none";

		return {
			state,
			label: getStatusLabel(input.status),
			color: fallbackColor,
			badgeVariant: getStatusVariant(input.status),
			indicator: fallbackIndicator,
			shouldPulse: false,
			requiresAttention: state === "in-execution",
			isFallback: true,
		};
	}

	const state = deriveTaskItemVisualState(input);
	const presentation = VISUAL_STATE_PRESENTATION[state];

	return {
		state,
		label: presentation.label,
		color: presentation.color,
		badgeVariant: presentation.badgeVariant,
		indicator: presentation.indicator,
		shouldPulse: presentation.shouldPulse,
		requiresAttention: presentation.requiresAttention,
		isFallback: false,
	};
}
