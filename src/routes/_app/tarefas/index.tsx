import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

import { PageShell } from "@/components/layout/page-shell";
import { TaskForm } from "./-components/task-form";
import { TaskList } from "./-components/task-list";
import { TaskSearch } from "./-components/task-search";
import { useCreateTask } from "./-utils/use-create-task";
import { useTasksData } from "./-utils/use-tasks-data";

const searchArraySchema = z.union([z.string(), z.array(z.string())]).optional();

const rawSearchSchema = z.object({
	q: z.string().optional(),

	// Canonical (preferred)
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	statusIds: searchArraySchema,
	includeCompleted: z.coerce.boolean().optional(),

	// Legacy (PT-BR) — kept for backwards compatibility
	projetoId: z.string().optional(),
	categoriaId: z.string().optional(),
	prioridadeId: z.string().optional(),
	status: searchArraySchema,
});

const searchSchema = z.object({
	q: z.string().optional(),
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	statusIds: z.array(z.string()).optional(),
	includeCompleted: z.boolean().optional(),
});

function normalizeSearchArray(value: string | string[] | undefined) {
	if (!value) return;

	const parsed = (Array.isArray(value) ? value : value.split(","))
		.map((item) => item.trim())
		.filter(Boolean)
		.filter((item, index, array) => array.indexOf(item) === index);

	return parsed.length > 0 ? parsed : undefined;
}

export const Route = createFileRoute("/_app/tarefas/")({
	validateSearch: (search) => {
		const raw = rawSearchSchema.parse(search);
		return searchSchema.parse({
			q: raw.q,
			projectId: raw.projectId ?? raw.projetoId,
			taskTypeId: raw.taskTypeId ?? raw.categoriaId,
			priorityId: raw.priorityId ?? raw.prioridadeId,
			statusIds: normalizeSearchArray(raw.statusIds ?? raw.status),
			includeCompleted: raw.includeCompleted,
		});
	},
	component: TarefasPage,
});

function TarefasPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data, loading } = useTasksData(search);
	const { createTask, loading: createLoading } = useCreateTask();

	function handleSearchChange(next: {
		q?: string;
		taskTypeId?: string;
		priorityId?: string;
		statusIds?: string[];
		includeCompleted?: boolean;
	}) {
		navigate({
			search: (prev) => ({
				...prev,
				q: next.q,
				taskTypeId: next.taskTypeId,
				priorityId: next.priorityId,
				statusIds: next.statusIds,
				includeCompleted: next.includeCompleted,
			}),
			replace: true,
		});
	}

	return (
		<PageShell
			title="Tarefas"
			description={`${data.pendingCount} pendentes, ${data.executedCount} concluídas`}
			icon={CheckCircle2}
		>
			<div className="flex h-full min-h-0 flex-col gap-4">
				<TaskForm onSubmit={createTask} loading={createLoading} />
				<TaskSearch
					value={{
						q: search.q,
						taskTypeId: search.taskTypeId,
						priorityId: search.priorityId,
						statusIds: search.statusIds,
						includeCompleted: search.includeCompleted,
					}}
					categories={data.categories}
					priorities={data.priorities}
					statuses={data.statuses}
					onChange={handleSearchChange}
				/>

				<div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-6">
					<TaskList tasks={data.tasks} loading={loading} />
				</div>
			</div>
		</PageShell>
	);
}
