import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
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
			icon={CheckCircle2}
		>
			<div className="flex h-full min-h-0 flex-col gap-4">
				<TaskForm
					projectId={data.selectedProjectId}
					onSubmit={createTask}
					loading={createLoading}
				/>

				<div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-6">
					<TaskList tasks={data.tasks} loading={loading} />
				</div>
			</div>
		</PageShell>
	);
}
