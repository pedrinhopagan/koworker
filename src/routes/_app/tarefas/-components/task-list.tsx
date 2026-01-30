import { TaskItem } from "@/components/tasks/TaskItem";
import { Text } from "@/components/typography";
import type { TaskWithMeta } from "@/types/tasks";

type TaskListProps = {
	tasks: TaskWithMeta[];
	loading: boolean;
};

export function TaskList({ tasks, loading }: TaskListProps) {
	if (loading) {
		return (
			<Text size="sm" tone="muted">
				Carregando tarefas...
			</Text>
		);
	}

	if (tasks.length === 0) {
		return (
			<Text size="sm" tone="muted">
				Nenhuma tarefa encontrada. Crie uma nova acima.
			</Text>
		);
	}

	return (
		<div className="space-y-2">
			{tasks.map((task) => (
				<TaskItem key={task.id} task={task} variant="default" />
			))}
		</div>
	);
}
