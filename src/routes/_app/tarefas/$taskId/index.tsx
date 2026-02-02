import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";

import { TaskActions } from "./-components/task-actions";
import { TaskDescription } from "./-components/task-description";
import { TaskHeader } from "./-components/task-header";
import { TaskMetadata } from "./-components/task-metadata";
import { TaskPageLayout } from "./-components/task-page-layout";
import { TaskQuickfix } from "./-components/task-quickfix";
import { TaskSubtasks } from "./-components/task-subtasks";

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	component: TaskDetailPage,
});

function TaskDetailPage() {
	const { taskId } = Route.useParams();

	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	if (taskQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando tarefa...
					</Text>
				</div>
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Tarefa não encontrada.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/tarefas">Voltar para tarefas</Link>
				</Button>
			</div>
		);
	}

	return (
		<TaskPageLayout
			header={<TaskHeader task={task} />}
			sidebar={
				<>
					<TaskActions suggestedActionId="execute_subtask" />
					<TaskQuickfix />
				</>
			}
			content={
				<div className="space-y-4">
					<TaskSubtasks task={task} />
					<TaskDescription task={task} />
					<TaskMetadata task={task} />
				</div>
			}
		/>
	);
}
