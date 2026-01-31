import { Link } from "@tanstack/react-router";
import { CalendarCheck, ChevronRight, ExternalLink, Inbox } from "lucide-react";
import { memo, useMemo } from "react";

import { Text, Title } from "@/components/typography";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { TaskWithMeta } from "@/types/tasks";

type TaskSummaryProps = {
	task: TaskWithMeta | null;
	onNavigate?: () => void;
};

const TaskSummary = memo(function TaskSummary({ task, onNavigate }: TaskSummaryProps) {
	if (!task) {
		return (
			<Card className="border-l-2 border-l-muted">
				<CardContent className="flex flex-col items-center justify-center py-8">
					<div className="p-3 bg-muted/50 mb-3">
						<Inbox size={24} className="text-muted-foreground" />
					</div>
					<Text tone="muted" size="sm">
						Nenhuma tarefa selecionada
					</Text>
					<Text tone="muted" size="xs" className="mt-1">
						Selecione uma tarefa para ver detalhes
					</Text>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-l-2" style={{ borderLeftColor: task.category.color }}>
			<CardHeader className="pb-3">
				<button
					type="button"
					onClick={onNavigate}
					className="group flex items-start justify-between gap-2 w-full text-left"
				>
					<div className="flex-1 min-w-0">
						<Title size="sm" className="truncate group-hover:text-primary transition-colors">
							{task.title}
						</Title>
						<Text size="xs" tone="muted">
							{task.statusLabel}
						</Text>
					</div>
					<ExternalLink
						size={14}
						className="text-muted-foreground group-hover:text-primary transition-colors mt-1"
					/>
				</button>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="flex items-center justify-center py-6">
					<div className="relative size-24 flex items-center justify-center">
						{/* Progress circle placeholder */}
						<div
							className="absolute inset-0 rounded-full border-4 border-muted"
							style={{ borderTopColor: task.category.color }}
						/>
						<Text size="lg" className="font-semibold">
							{task.status === "executed" ? "100%" : "0%"}
						</Text>
					</div>
				</div>
				<div className="flex flex-wrap gap-2 justify-center">
					<span
						className="px-2 py-1 text-xs rounded"
						style={{ backgroundColor: `${task.category.color}20`, color: task.category.color }}
					>
						{task.category.name}
					</span>
					<span
						className="px-2 py-1 text-xs rounded"
						style={{ backgroundColor: `${task.priority.color}20`, color: task.priority.color }}
					>
						{task.priority.name}
					</span>
				</div>
			</CardContent>
		</Card>
	);
});

type DayTasksListProps = {
	tasks: TaskWithMeta[];
	selectedDate: string;
	selectedTaskId: string | null;
	onTaskSelect: (taskId: string) => void;
};

const DayTasksList = memo(function DayTasksList({
	tasks,
	selectedDate,
	selectedTaskId,
	onTaskSelect,
}: DayTasksListProps) {
	const today = new Date();
	const isToday = selectedDate === today.toISOString().split("T")[0];
	const dateLabel = isToday ? "Hoje" : selectedDate;

	// Filter tasks for selected date (placeholder - tasks don't have scheduledDate yet)
	const dayTasks = useMemo(() => {
		// For now, show first 5 pending tasks as "today's tasks"
		return tasks.filter((t) => t.status === "pending").slice(0, 5);
	}, [tasks]);

	return (
		<div className="space-y-3">
			<Link to="/agenda" className="flex items-center justify-between gap-2 group">
				<div className="flex items-center gap-2">
					<Icon icon={CalendarCheck} color="var(--project-accent, var(--primary))" size="xs" />
					<Text
						size="sm"
						className="font-medium uppercase tracking-wide group-hover:text-primary transition-colors"
					>
						Tarefas - {dateLabel}
					</Text>
				</div>
				<ChevronRight
					size={14}
					className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
				/>
			</Link>

			{dayTasks.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-8">
						<CalendarCheck size={24} className="text-muted-foreground mb-2" />
						<Text tone="muted" size="sm">
							Nenhuma tarefa para {dateLabel.toLowerCase()}
						</Text>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className="p-2 space-y-1">
						{dayTasks.map((task) => (
							<button
								key={task.id}
								type="button"
								onClick={() => onTaskSelect(task.id)}
								className={cn(
									"w-full text-left px-3 py-2 transition-colors hover:bg-muted/50",
									selectedTaskId === task.id && "bg-primary/10 border-l-2 border-l-primary",
								)}
							>
								<Text size="sm" className="truncate">
									{task.title}
								</Text>
								<Text size="xs" tone="muted">
									{task.category.name}
								</Text>
							</button>
						))}
					</CardContent>
				</Card>
			)}
		</div>
	);
});

type HomeSidebarProps = {
	selectedTask: TaskWithMeta | null;
	tasks: TaskWithMeta[];
	selectedDate: string;
	selectedTaskId: string | null;
	onTaskSelect: (taskId: string) => void;
	className?: string;
};

export const HomeSidebar = memo(function HomeSidebar({
	selectedTask,
	tasks,
	selectedDate,
	selectedTaskId,
	onTaskSelect,
	className,
}: HomeSidebarProps) {
	return (
		<aside className={cn("flex flex-col h-full overflow-hidden", className)}>
			{/* Gradient background effect */}
			<div
				className="absolute top-0 left-0 right-0 h-32 pointer-events-none opacity-40"
				style={{
					background:
						"radial-gradient(ellipse at top center, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
				}}
			/>

			<div className="relative flex-1 overflow-y-auto space-y-4 p-4">
				<TaskSummary task={selectedTask} />

				<div className="border-t border-border/30" />

				<DayTasksList
					tasks={tasks}
					selectedDate={selectedDate}
					selectedTaskId={selectedTaskId}
					onTaskSelect={onTaskSelect}
				/>
			</div>
		</aside>
	);
});
