import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListChecks, Loader2, Terminal } from "lucide-react";
import { tv, type VariantProps } from "tailwind-variants";

import { orpc } from "@/client";
import { CompletionToggle } from "@/components/tasks/CompletionToggle";
import { Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { deriveTaskAttentionState } from "@/domain/tasks/attention";
import { getStatusVariant } from "@/domain/tasks/status";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useIsProjectTerminalOpen } from "@/stores/terminal-status";
import type { TaskWithMeta } from "@/types/tasks";
import { type AgendaTaskItemVariant, TaskItemAgendaVariant } from "./task-item-agenda-variant";

const taskItemVariants = tv({
	base: "flex items-center justify-between gap-4 border border-transparent bg-card transition-all duration-200 hover:border-border hover:bg-secondary/30 animate-fade-in w-full truncate",
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

type TaskItemDefaultProps = {
	task: TaskWithMeta;
	variant: "default" | "compact";
};

function TaskItemDefault({ task, variant }: TaskItemDefaultProps) {
	const queryClient = useQueryClient();
	const effectiveStatus = task.status;
	const isDone = Boolean(task.completedAt);
	const statusVariant = getStatusVariant(effectiveStatus);
	const isTerminalOpen = useIsProjectTerminalOpen(task.projectId);

	const subtasks = task.subtasks ?? [];
	const firstNotCompleted = subtasks.find((st) => {
		const s = normalizeStatus(st.status);
		return s !== "executed";
	});
	const firstNotCompletedStatus = firstNotCompleted
		? normalizeStatus(firstNotCompleted.status)
		: null;

	const subtaskProgress = {
		completed: subtasks.filter((st) => normalizeStatus(st.status) === "executed").length,
		total: subtasks.length,
	};

	const getProgressVariant = () => {
		if (subtaskProgress.total === 0) return null;
		if (subtaskProgress.completed === 0) return "destructive";
		if (subtaskProgress.completed === subtaskProgress.total) return "success";
		return "warning";
	};

	const progressVariant = getProgressVariant();

	const attention = deriveTaskAttentionState({
		status: effectiveStatus,
		description: task.description,
		aiMetadata: task.aiMetadata as { lastCompletedAction?: string | null } | null,
		subtasks,
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

	const isMaxAttention =
		(task.status === "in_execution" && firstNotCompletedStatus === "in_execution") ||
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
				attention.shouldPulse && "animate-pulse",
				attention.requiresAttention && "hover:bg-secondary/40",
			)}
			style={containerStyle}
			data-attention={attention.progressState}
		>
			<div className="flex min-w-0 items-center gap-3 flex-1">
				<CompletionToggle
					checked={isDone}
					onCheckedChange={() => {
						const completedAt = isDone ? null : Date.now();
						updateTaskMutation.mutate({ id: task.id, completedAt });
					}}
					disabled={updateTaskMutation.isPending}
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

			<div className="flex flex-1 self-end justify-end shrink-0 items-center gap-2">
				{isTauri() && isTerminalOpen && (
					<span title="Terminal ativo">
						<Terminal size={14} className="text-green-500" />
					</span>
				)}

				{isMaxAttention ? (
					<Loader2 size={14} className="animate-spin text-purple-300" />
				) : attention.shouldSpin ? (
					<Loader2 size={14} className="animate-spin text-muted-foreground" />
				) : null}

				{subtaskProgress.total > 0 && progressVariant && (
					<Badge variant={progressVariant} className="shrink-0 flex items-center gap-1">
						<ListChecks size={12} />
						{subtaskProgress.completed}/{subtaskProgress.total}
					</Badge>
				)}

				<Badge
					variant={statusVariant}
					className="shrink-0"
					style={{
						backgroundColor: `${attention.color}20`,
						color: attention.color,
					}}
				>
					{attention.label}
				</Badge>

				<Badge
					variant="muted"
					className="shrink-0"
					style={{
						backgroundColor: `${task.category.color}20`,
						color: task.category.color,
					}}
				>
					{task.category.name}
				</Badge>

				<Badge
					variant="muted"
					className={cn("shrink-0", isMaxAttention && "text-white")}
					style={{
						backgroundColor: isMaxAttention
							? "rgba(239, 68, 68, 0.35)"
							: `${task.priority.color}20`,
						color: isMaxAttention ? "#fff" : task.priority.color,
					}}
				>
					{task.priority.name}
				</Badge>
			</div>
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
