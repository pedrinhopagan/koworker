import { Link } from "@tanstack/react-router";
import { Activity, CheckCircle2, Loader2, Terminal } from "lucide-react";
import { memo } from "react";

import { Text } from "@/components/typography";
import { cn } from "@/lib/utils";
import { useTerminalOpenTaskIds } from "@/terminal/hooks";
import { useTerminalStore } from "@/terminal/store";
import { sortTasksByTerminal } from "@/terminal/task-sort";
import type { TaskWithMeta } from "@/types/tasks";

import { SectionHeader } from "./section-header";

// Empty section placeholder
type EmptySectionProps = {
	icon: React.ReactNode;
	message: string;
	linkTo?: string;
	linkLabel?: string;
};

const EmptySection = memo(function EmptySection({
	icon,
	message,
	linkTo,
	linkLabel,
}: EmptySectionProps) {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-center">
			<div className="p-3 bg-muted/30 mb-3">{icon}</div>
			<Text tone="muted" size="sm" className="mb-2">
				{message}
			</Text>
			{linkTo && linkLabel && (
				<Link to={linkTo} className="text-xs text-primary hover:text-primary/80 transition-colors">
					{linkLabel} →
				</Link>
			)}
		</div>
	);
});

// Loading state
const LoadingState = memo(function LoadingState() {
	return (
		<div className="flex items-center justify-center py-8">
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 size={16} className="animate-spin" />
				<Text size="sm">Carregando...</Text>
			</div>
		</div>
	);
});

// Compact task item for the list
type TaskItemCompactProps = {
	task: TaskWithMeta;
	isSelected: boolean;
	onClick: () => void;
};

const TaskItemCompact = memo(function TaskItemCompact({
	task,
	isSelected,
	onClick,
}: TaskItemCompactProps) {
	const isTerminalOpen = useTerminalStore((state) => !!state.sessionsByTask[task.id]);
	const isDone = task.status === "executed" && !isTerminalOpen;

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"w-full flex items-center justify-between gap-3 px-3 py-2.5",
				"border border-border bg-card transition-colors",
				"hover:border-primary/40 hover:bg-muted/30",
				isSelected && "border-primary/60 bg-primary/5",
				isTerminalOpen && "border-sky-400/60 bg-sky-500/10",
			)}
		>
			<div className="flex items-center gap-3 min-w-0">
				<input
					type="checkbox"
					checked={isDone}
					readOnly
					className="size-4 rounded border-border"
				/>
				<Text size="sm" className="truncate">
					{task.title}
				</Text>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				{isTerminalOpen && <Terminal size={14} className="text-sky-400" />}
				<span
					className="px-2 py-0.5 text-xs rounded"
					style={{
						backgroundColor: `${task.category.color}20`,
						color: task.category.color,
					}}
				>
					{task.category.name}
				</span>
			</div>
		</button>
	);
});

// Task list section component
type TaskListSectionProps = {
	tasks: TaskWithMeta[];
	loading: boolean;
	selectedTaskId: string | null;
	onTaskClick: (taskId: string) => void;
};

export function TaskListSection({
	tasks,
	loading,
	selectedTaskId,
	onTaskClick,
}: TaskListSectionProps) {
	const openTaskIds = useTerminalOpenTaskIds();
	const inProgressCount = tasks.filter(
		(t) => openTaskIds.includes(t.id) || t.status === "pending" || t.status === "in_execution",
	).length;
	const orderedTasks = sortTasksByTerminal(tasks, openTaskIds);

	return (
		<section>
			<SectionHeader
				title="Tarefas em Andamento"
				icon={Activity}
				linkTo="/tarefas"
				linkLabel="ver todas"
				badge={inProgressCount > 0 ? inProgressCount : undefined}
				accentColor="hsl(var(--warning))"
			/>

			<div className="space-y-1">
				{loading ? (
					<LoadingState />
				) : tasks.length === 0 ? (
					<EmptySection
						icon={<CheckCircle2 size={20} className="text-muted-foreground" />}
						message="Nenhuma tarefa em andamento"
						linkTo="/tarefas"
						linkLabel="Criar nova tarefa"
					/>
				) : (
					orderedTasks.map((task) => (
						<TaskItemCompact
							key={task.id}
							task={task}
							isSelected={selectedTaskId === task.id}
							onClick={() => onTaskClick(task.id)}
						/>
					))
				)}
			</div>
		</section>
	);
}
