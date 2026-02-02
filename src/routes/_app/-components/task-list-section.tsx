import { Link } from "@tanstack/react-router";
import { Activity, CheckCircle2, Loader2 } from "lucide-react";
import { memo } from "react";
import { TaskItem } from "@/components/tasks";
import { Text } from "@/components/typography";
import { sortTasksByAttention } from "@/domain/tasks/sort";
import type { TaskWithMeta } from "@/types/tasks";
import { SectionHeader } from "./section-header";

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

type TaskListSectionProps = {
	tasks: TaskWithMeta[];
	loading: boolean;
	selectedTaskId: string | null;
	onTaskClick: (taskId: string) => void;
};

export function TaskListSection({ tasks, loading }: TaskListSectionProps) {
	const inProgressCount = tasks.filter(
		(t) => t.status === "pending" || t.status === "in_execution",
	).length;
	const orderedTasks = sortTasksByAttention(tasks);

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
					orderedTasks.map((task) => <TaskItem key={task.id} task={task} />)
				)}
			</div>
		</section>
	);
}
