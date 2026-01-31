import { Loader2 } from "lucide-react";
import { memo } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";
import { TaskItem, type TaskItemVariant } from "./TaskItem";

const taskListVariants = tv({
	slots: {
		root: "flex flex-col",
		list: "flex flex-col",
		emptyState:
			"flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground",
		loadingState: "flex flex-1 items-center justify-center gap-2 text-muted-foreground",
		groupHeader: "mt-4 mb-2 text-xs uppercase tracking-wide text-muted-foreground",
		doneGroup: "opacity-50",
	},
	variants: {
		variant: {
			default: {
				list: "space-y-1",
			},
			compact: {
				list: "space-y-0.5",
			},
		},
	},
	defaultVariants: {
		variant: "default",
	},
});

export type TaskListVariant = VariantProps<typeof taskListVariants>["variant"];

type TaskListProps = {
	tasks: TaskWithMeta[];
	variant?: TaskListVariant;
	emptyMessage?: string;
	isLoading?: boolean;
	separateDone?: boolean;
	onTaskClick?: (taskId: string) => void;
};

export const TaskList = memo(function TaskList({
	tasks,
	variant = "default",
	emptyMessage = "Nenhuma tarefa encontrada.",
	isLoading = false,
	separateDone = false,
	onTaskClick,
}: TaskListProps) {
	const styles = taskListVariants({ variant });
	const itemVariant: TaskItemVariant = variant;

	if (isLoading) {
		return (
			<div className={styles.loadingState()}>
				<Loader2 size={16} className="animate-spin" aria-hidden="true" />
				<span className="text-sm">Carregando tarefas...</span>
			</div>
		);
	}

	if (tasks.length === 0) {
		return <div className={styles.emptyState()}>{emptyMessage}</div>;
	}

	const renderTask = (task: TaskWithMeta, index: number) => (
		<button
			type="button"
			key={task.id}
			onClick={() => onTaskClick?.(task.id)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onTaskClick?.(task.id);
				}
			}}
			disabled={!onTaskClick}
			className={cn(
				onTaskClick ? "cursor-pointer" : "cursor-default",
				"animate-stagger-fade-in opacity-0",
			)}
			style={{ animationDelay: `${index * 0.05}s` }}
		>
			<TaskItem task={task} variant={itemVariant} />
		</button>
	);

	if (separateDone) {
		const pendingTasks = tasks.filter((t) => t.status !== "executed");
		const doneTasks = tasks.filter((t) => t.status === "executed");

		return (
			<div className={styles.root()}>
				{pendingTasks.length > 0 && (
					<div className={styles.list()}>{pendingTasks.map((task, i) => renderTask(task, i))}</div>
				)}

				{doneTasks.length > 0 && (
					<>
						<div className={styles.groupHeader()}>Concluídas ({doneTasks.length})</div>
						<div className={`${styles.list()} ${styles.doneGroup()}`}>
							{doneTasks.map((task, i) => renderTask(task, i))}
						</div>
					</>
				)}
			</div>
		);
	}

	return <div className={styles.list()}>{tasks.map((task, i) => renderTask(task, i))}</div>;
});
