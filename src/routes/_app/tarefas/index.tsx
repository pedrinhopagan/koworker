import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PageShell } from "@/routes/_app/-components/page-shell";
import { TaskForm } from "./-components/task-form";
import { TaskList } from "./-components/task-list";
import { useCreateTask } from "./-utils/use-create-task";
import { useTasksData } from "./-utils/use-tasks-data";

const searchSchema = z.object({
	q: z.string().optional(),
	projetoId: z.string().optional(),
	categoriaId: z.string().optional(),
	prioridadeId: z.string().optional(),
	status: z.enum(["pending", "in_execution", "executed"]).optional(),
	pagina: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute("/_app/tarefas/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: TarefasPage,
});

function TarefasPage() {
	const { projetoId } = Route.useSearch();
	const { data, loading } = useTasksData(projetoId);
	const { createTask, loading: createLoading } = useCreateTask();

	return (
		<PageShell
			title="Tarefas"
			description={`${data.pendingCount} pendentes, ${data.executedCount} concluídas`}
		>
			<div className="space-y-6">
				<TaskForm
					projectId={data.selectedProjectId}
					onSubmit={createTask}
					loading={createLoading}
				/>

				<TaskList tasks={data.tasks} loading={loading} />
			</div>
		</PageShell>
	);
}
