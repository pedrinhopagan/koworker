import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { CategorySelect, PrioritySelect } from "@/components/tasks";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { TaskDetailsSection } from "./-components/task-details";

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	component: TaskDetailPage,
});

function TaskDetailPage() {
	const { taskId } = Route.useParams();
	const queryClient = useQueryClient();

	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	const updateTaskMutation = useMutation({
		...orpc.tasks.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (q) => Array.isArray(q.queryKey?.[0]) && q.queryKey[0][0] === "tasks",
			});
		},
	});

	if (taskQuery.isLoading) {
		return (
			<PageShell title="Tarefa" description="Carregando detalhes da tarefa..." icon={CheckCircle2}>
				<Text size="sm" tone="muted">
					Carregando tarefa...
				</Text>
			</PageShell>
		);
	}

	if (!task) {
		return (
			<PageShell title="Tarefa" description={`ID: ${taskId}`} icon={CheckCircle2}>
				<div className="space-y-3">
					<Text size="sm" tone="muted">
						Tarefa não encontrada.
					</Text>

					<Button variant="outline" asChild>
						<Link to="/tarefas">Voltar para tarefas</Link>
					</Button>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			title={task.title}
			description={`ID: ${taskId}`}
			icon={CheckCircle2}
			actions={
				<div className="flex flex-wrap items-center gap-2">
					<CategorySelect
						value={task.categoryId}
						disabled={updateTaskMutation.isPending}
						onValueChange={(categoryId) => {
							updateTaskMutation.mutate({ id: taskId, categoryId });
						}}
					/>
					<PrioritySelect
						value={task.priorityId}
						disabled={updateTaskMutation.isPending}
						onValueChange={(priorityId) => {
							updateTaskMutation.mutate({ id: taskId, priorityId });
						}}
					/>
				</div>
			}
		>
			<div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto">
				<TaskDetailsSection task={task} />
			</div>
		</PageShell>
	);
}
