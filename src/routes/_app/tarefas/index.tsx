import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

import { PageShell } from "@/routes/_app/-components/page-shell";
import { TaskForm } from "./-components/task-form";
import { TaskList } from "./-components/task-list";
import { useCreateTask } from "./-utils/use-create-task";
import { useTasksData } from "./-utils/use-tasks-data";

const rawSearchSchema = z.object({
	q: z.string().optional(),

	// Canonical (preferred)
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	status: z.enum(["pending", "in_execution", "executed"]).optional(),
	includeCompleted: z.coerce.boolean().optional(),
	page: z.coerce.number().int().min(1).optional(),

	// Legacy (PT-BR) — kept for backwards compatibility
	projetoId: z.string().optional(),
	categoriaId: z.string().optional(),
	prioridadeId: z.string().optional(),
	pagina: z.coerce.number().int().min(1).optional(),
});

const searchSchema = z.object({
	q: z.string().optional(),
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	status: z.enum(["pending", "in_execution", "executed"]).optional(),
	includeCompleted: z.boolean().optional().default(true),
	page: z.number().int().min(1).optional(),
});

export const Route = createFileRoute("/_app/tarefas/")({
	validateSearch: (search) => {
		const raw = rawSearchSchema.parse(search);
		return searchSchema.parse({
			q: raw.q,
			projectId: raw.projectId ?? raw.projetoId,
			taskTypeId: raw.taskTypeId ?? raw.categoriaId,
			priorityId: raw.priorityId ?? raw.prioridadeId,
			status: raw.status,
			includeCompleted: raw.includeCompleted,
			page: raw.page ?? raw.pagina,
		});
	},
	component: TarefasPage,
});

function TarefasPage() {
	const search = Route.useSearch();
	const { data, loading } = useTasksData(search);
	const { createTask, loading: createLoading } = useCreateTask();

	return (
		<PageShell
			title="Tarefas"
			description={`${data.pendingCount} pendentes, ${data.executedCount} concluídas`}
			icon={CheckCircle2}
		>
			<div className="flex h-full min-h-0 flex-col gap-4">
				<TaskForm onSubmit={createTask} loading={createLoading} />

				<div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-6">
					<TaskList tasks={data.tasks} loading={loading} />
				</div>
			</div>
		</PageShell>
	);
}
