import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

import { PageShell } from "@/components/layout/page-shell";
import { useTaskGroupsUiStore } from "@/stores/task-groups-ui";
import { GroupedTaskList, NO_GROUP } from "./-components/grouped-task-list";
import { TaskForm } from "./-components/task-form";
import { TaskListControls, useSortMode } from "./-components/task-groups-controls";
import { useCreateTask } from "./-utils/use-create-task";
import { useTasksData } from "./-utils/use-tasks-data";

const rawSearchSchema = z.object({
	q: z.string().optional(),

	// Canonical (preferred)
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	includeCompleted: z.coerce.boolean().optional(),

	// Legacy (PT-BR) — kept for backwards compatibility
	projetoId: z.string().optional(),
	categoriaId: z.string().optional(),
	prioridadeId: z.string().optional(),
});

const searchSchema = z.object({
	q: z.string().optional(),
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	includeCompleted: z.boolean().optional(),
});

export const Route = createFileRoute("/_app/tarefas/")({
	validateSearch: (search) => {
		const raw = rawSearchSchema.parse(search);
		return searchSchema.parse({
			q: raw.q,
			projectId: raw.projectId ?? raw.projetoId,
			taskTypeId: raw.taskTypeId ?? raw.categoriaId,
			priorityId: raw.priorityId ?? raw.prioridadeId,
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
	const [sortMode, setSortMode] = useSortMode();
	// Colapso por grupo (chaveado por `id ?? NO_GROUP`) e ordem do "Sem grupo" vivem no store
	// persistido; a lista lê o mesmo store. Aqui só os atalhos globais de colapsar/expandir tudo.
	const setCollapsed = useTaskGroupsUiStore((state) => state.setCollapsed);

	function handleSearchChange(next: {
		q?: string;
		taskTypeId?: string;
		priorityId?: string;
		includeCompleted?: boolean;
	}) {
		navigate({
			search: (prev) => ({
				...prev,
				q: next.q,
				taskTypeId: next.taskTypeId,
				priorityId: next.priorityId,
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
			<div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
				<TaskForm onSubmit={createTask} loading={createLoading} />
				<TaskListControls
					projectId={data.selectedProjectId ?? null}
					search={{
						value: {
							q: search.q,
							taskTypeId: search.taskTypeId,
							priorityId: search.priorityId,
							includeCompleted: search.includeCompleted,
						},
						onChange: handleSearchChange,
					}}
					categories={data.categories}
					priorities={data.priorities}
					sortMode={sortMode}
					onSortModeChange={setSortMode}
					onCollapseAll={() => setCollapsed([...data.groups.map((group) => group.id), NO_GROUP])}
					onExpandAll={() => setCollapsed([])}
				/>

				<div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-2 pb-6">
					<GroupedTaskList
						tasks={data.tasks}
						groups={data.groups}
						categories={data.categories}
						priorities={data.priorities}
						loading={loading}
						sortMode={sortMode}
					/>
				</div>
			</div>
		</PageShell>
	);
}
