import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListChecks, Loader2, Terminal } from "lucide-react";
import type { MouseEvent } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { orpc } from "@/client";
import { Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { deriveTaskAttentionState } from "@/domain/tasks/attention";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/terminal/store";
import type { TaskWithMeta } from "@/types/tasks";

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

const statusVariants = {
	pending: "muted",
	in_execution: "warning",
	executed: "success",
} as const;

export type TaskItemVariant = VariantProps<typeof taskItemVariants>["variant"];

type TaskItemProps = {
	task: TaskWithMeta;
	variant?: TaskItemVariant;
};

function normalizeStatus(status: unknown): "pending" | "in_execution" | "executed" {
	// Compat com dados legados no DB
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

export function TaskItem({ task, variant = "default" }: TaskItemProps) {
	const queryClient = useQueryClient();
	const isTerminalOpen = useTerminalStore((state) => !!state.sessionsByTask[task.id]);
	const effectiveStatus = isTerminalOpen ? "in_execution" : task.status;
	const isDone = Boolean(task.completedAt);
	const statusVariant = statusVariants[effectiveStatus] ?? "muted";

	const subtasks = task.subtasks ?? [];
	const firstNotCompleted = subtasks.find((st) => {
		const s = normalizeStatus(st.status);
		return s !== "executed";
	});
	const firstNotCompletedStatus = firstNotCompleted
		? normalizeStatus(firstNotCompleted.status)
		: null;

	// Calculate subtask progress
	const subtaskProgress = {
		completed: subtasks.filter((st) => normalizeStatus(st.status) === "executed").length,
		total: subtasks.length,
	};

	// Determine progress color
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

	function handleToggleComplete(e: MouseEvent<HTMLButtonElement>) {
		e.preventDefault();
		e.stopPropagation();
		const completedAt = isDone ? null : Date.now();
		updateTaskMutation.mutate({ id: task.id, completedAt });
	}

	// Estado “máximo” (vermelho + roxo + spinner): pai em execução E primeira subtask também em execução
	const isMaxAttention =
		isTerminalOpen ||
		(task.status === "in_execution" && firstNotCompletedStatus === "in_execution") ||
		attention.shouldSpin;

	const containerStyle: React.CSSProperties | undefined = isMaxAttention
		? {
				backgroundImage: isTerminalOpen
					? "linear-gradient(90deg, rgba(14, 116, 144, 0.22), rgba(59, 130, 246, 0.16))"
					: "linear-gradient(90deg, rgba(239, 68, 68, 0.16), rgba(168, 85, 247, 0.14))",
				borderColor: isTerminalOpen ? "rgba(56, 189, 248, 0.4)" : "rgba(239, 68, 68, 0.35)",
				boxShadow: isTerminalOpen ? "0 0 0 1px rgba(56, 189, 248, 0.15) inset" : undefined,
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
				<button
					type="button"
					onClick={handleToggleComplete}
					disabled={updateTaskMutation.isPending}
					className={cn("text-muted-foreground transition-colors", isDone && "text-primary")}
					aria-label={isDone ? "Marcar como não concluída" : "Marcar como concluída"}
				>
					{isDone ? "[x]" : "[ ]"}
				</button>
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
				{isMaxAttention ? (
					<Loader2
						size={14}
						className={cn("animate-spin", isTerminalOpen ? "text-sky-300" : "text-purple-300")}
					/>
				) : attention.shouldSpin ? (
					<Loader2 size={14} className="animate-spin text-muted-foreground" />
				) : null}

				{/* Subtask counter */}
				{subtaskProgress.total > 0 && progressVariant && (
					<Badge variant={progressVariant} className="shrink-0 flex items-center gap-1">
						<ListChecks size={12} />
						{subtaskProgress.completed}/{subtaskProgress.total}
					</Badge>
				)}

				{isTerminalOpen && (
					<Badge variant="warning" className="shrink-0 flex items-center gap-1">
						<Terminal size={12} />
						Terminal ativo
					</Badge>
				)}

				{/* Badge principal: estado derivado/atenção */}
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

				{/* Categoria/Tipo */}
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

				{/* Prioridade: define cor base (mais alto = mais vermelho) */}
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
