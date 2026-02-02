import { useMemo } from "react";

import { TaskItem } from "@/components/tasks";
import { Text } from "@/components/typography";
import { sortTasksByAttention } from "@/domain/tasks/sort";
import type { TaskWithMeta } from "@/types/tasks";

type TaskListProps = {
	tasks: TaskWithMeta[];
	loading: boolean;
};

export function TaskList({ tasks, loading }: TaskListProps) {
	const orderedTasks = useMemo(() => sortTasksByAttention(tasks), [tasks]);

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
			{orderedTasks.map((task) => (
				<TaskItem key={task.id} task={task} variant="default" />
			))}
		</div>
	);
}
