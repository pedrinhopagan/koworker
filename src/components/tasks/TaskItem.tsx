import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { tv, type VariantProps } from "tailwind-variants";

import { orpc } from "@/client";
import { CompletionToggle } from "@/components/tasks/CompletionToggle";
import { TaskItemBadges } from "@/components/tasks/task-item-badges";
import { Title } from "@/components/typography";
import type { BadgeVariant } from "@/components/ui/badge";
import { deriveTaskAttentionState } from "@/domain/tasks/attention";
import { getStatusVariant } from "@/domain/tasks/status";
import { getTaskItemStatusPresentation } from "@/domain/tasks/task-item-visual-state";
import { cn } from "@/lib/utils";
import { useIsProjectTerminalOpen } from "@/stores/terminal-status";
import type { TaskWithMeta } from "@/types/tasks";
import { type AgendaTaskItemVariant, TaskItemAgendaVariant } from "./task-item-agenda-variant";

const taskItemVariants = tv({
	base: "flex items-center justify-between gap-4 border border-transparent bg-card transition-all duration-200 hover:border-border hover:bg-secondary/30 animate-fade-in w-full min-w-0 overflow-hidden",
	variants: {
		variant: {
			default: "px-3 py-2",
			compact: "px-3 py-1.5",
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

export type TaskItemVariant =
	| VariantProps<typeof taskItemVariants>["variant"]
	| AgendaTaskItemVariant;

type TaskItemProps = {
	task: TaskWithMeta;
	variant?: TaskItemVariant;
	showScheduledDate?: boolean;
};

function normalizeStatus(status: unknown): "pending" | "in_execution" | "executed" {
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

function getProgressVariant(completed: number, total: number): BadgeVariant | null {
	if (total === 0) return null;
	if (completed === 0) return "destructive";
	if (completed === total) return "success";
	return "warning";
}

type TaskItemDefaultProps = {
	task: TaskWithMeta;
	variant: "default" | "compact";
};

function TaskItemDefault({ task, variant }: TaskItemDefaultProps) {
	const queryClient = useQueryClient();
	const isDefaultVariant = variant === "default";
	const effectiveStatus = task.status;
	const isDone = Boolean(task.completedAt);
	const isTerminalOpen = useIsProjectTerminalOpen(task.projectId);
	const statusVariant = getStatusVariant(effectiveStatus);

	const subtasks = task.subtasks ?? [];
	const acceptanceCriteria = task.acceptanceCriteria ?? [];
	const firstNotCompleted = subtasks.find((st) => normalizeStatus(st.status) !== "executed");
	const firstNotCompletedStatus = firstNotCompleted
		? normalizeStatus(firstNotCompleted.status)
		: null;

	const subtaskProgress = {
		completed: subtasks.filter((st) => normalizeStatus(st.status) === "executed").length,
		total: subtasks.length,
		variant: getProgressVariant(
			subtasks.filter((st) => normalizeStatus(st.status) === "executed").length,
			subtasks.length,
		),
	};

	const criteriaProgress = {
		completed: acceptanceCriteria.filter((criterion) => criterion.done).length,
		total: acceptanceCriteria.length,
		variant: getProgressVariant(
			acceptanceCriteria.filter((criterion) => criterion.done).length,
			acceptanceCriteria.length,
		),
	};

	const aiMetadata = task.aiMetadata as { lastCompletedAction?: string | null } | null;

	const attention = deriveTaskAttentionState({
		status: effectiveStatus,
		description: task.description,
		aiMetadata,
		subtasks,
		completedAt: task.completedAt ?? null,
	});

	const statusPresentation = getTaskItemStatusPresentation({
		status: effectiveStatus,
		description: task.description,
		aiMetadata,
		subtasks,
		acceptanceCriteria,
		completedAt: task.completedAt ?? null,
	});

	const updateTaskMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	const removeTaskMutation = useMutation({
		...orpc.tasks.remove.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	const isMutating = updateTaskMutation.isPending || removeTaskMutation.isPending;

	const isMaxAttention = isDefaultVariant
		? statusPresentation.state === "in-execution"
		: (task.status === "in_execution" && firstNotCompletedStatus === "in_execution") ||
			attention.shouldSpin;

	const containerStyle: React.CSSProperties | undefined = isMaxAttention
		? {
				backgroundImage:
					"linear-gradient(90deg, rgba(239, 68, 68, 0.16), rgba(168, 85, 247, 0.14))",
				borderColor: "rgba(239, 68, 68, 0.35)",
			}
		: {
				borderColor: `${task.priority.color}30`,
			};

	return (
		<Link
			to="/tarefas/$taskId"
			params={{ taskId: task.id }}
			className={cn(
				taskItemVariants({ variant }),
				"border",
				isDefaultVariant && statusPresentation.shouldPulse && "animate-pulse",
				isDefaultVariant && statusPresentation.requiresAttention && "hover:bg-secondary/40",
				isDefaultVariant && statusPresentation.state === "done" && "opacity-60",
				!isDefaultVariant && attention.shouldPulse && "animate-pulse",
				!isDefaultVariant && attention.requiresAttention && "hover:bg-secondary/40",
			)}
			style={containerStyle}
			data-attention={isDefaultVariant ? statusPresentation.state : attention.progressState}
		>
			<div className="flex min-w-0 items-center gap-3 flex-1">
				<CompletionToggle
					checked={isDone}
					onCheckedChange={() => {
						const completedAt = isDone ? null : Date.now();
						updateTaskMutation.mutate({ id: task.id, completedAt });
					}}
					disabled={isMutating}
					aria-label={isDone ? "Marcar como não concluída" : "Marcar como concluída"}
				/>
				<Title
					as="span"
					size="sm"
					className={cn(
						"truncate text-sm font-normal max-w-2xl",
						isDone && "line-through text-muted-foreground",
					)}
				>
					{task.title}
				</Title>
			</div>

			<TaskItemBadges
				isDefaultVariant={isDefaultVariant}
				isMaxAttention={isMaxAttention}
				isTerminalOpen={isTerminalOpen}
				isMutating={isMutating}
				statusPresentation={statusPresentation}
				attention={attention}
				statusVariant={statusVariant}
				subtaskProgress={subtaskProgress}
				criteriaProgress={criteriaProgress}
				category={task.category}
				priority={task.priority}
				onDelete={() => removeTaskMutation.mutate({ id: task.id })}
			/>
		</Link>
	);
}

export function TaskItem({ task, variant = "default", showScheduledDate = false }: TaskItemProps) {
	if (variant === "agendaBacklog" || variant === "agendaMini") {
		return (
			<TaskItemAgendaVariant task={task} variant={variant} showScheduledDate={showScheduledDate} />
		);
	}

	return <TaskItemDefault task={task} variant={variant} />;
}
