import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Inbox, Loader2, Plus, WifiOff } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { TASK_COMPLEXITIES } from "@/constants/complexity";
import { useTaskSortMode } from "@/hooks/use-task-sort-mode";
import { useTaskGroupsUiStore } from "@/stores/task-groups-ui";
import { useSelectedProjectStore } from "@/stores/selected-project";
import {
	GroupedTaskList,
	GroupedTaskListByProject,
	noGroupKey,
} from "./-components/grouped-task-list";
import { TaskForm } from "./-components/task-form";
import { TaskSyncAction } from "./-components/task-sync-dialog";
import { TaskTriagePanel, type TriageSearch } from "./-components/task-triage-panel";
import { useCreateTask } from "./-utils/use-create-task";
import { useTasksData } from "./-utils/use-tasks-data";

function collapseAllKeys(data: {
	groups: { id: string }[];
	projects: { id: string }[];
	selectedProjectId: string | undefined;
}) {
	const groupIds = data.groups.map((group) => group.id);
	return data.selectedProjectId === undefined
		? [...groupIds, ...data.projects.map((project) => noGroupKey(project.id))]
		: [...groupIds, noGroupKey()];
}

const rawSearchSchema = z.object({
	q: z.string().optional(),
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	complexity: z.enum(TASK_COMPLEXITIES).optional(),
	includeCompleted: z.coerce.boolean().optional(),
	projetoId: z.string().optional(),
	categoriaId: z.string().optional(),
	prioridadeId: z.string().optional(),
});

// Keep the route search output optional. Returning explicit undefined values in an
// object literal makes TanStack Router infer every filter as a required search key.
const searchSchema = z.object({
	q: z.string().optional(),
	projectId: z.string().optional(),
	taskTypeId: z.string().optional(),
	priorityId: z.string().optional(),
	complexity: z.enum(TASK_COMPLEXITIES).optional(),
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
			complexity: raw.complexity,
			includeCompleted: raw.includeCompleted,
		});
	},
	component: TarefasPage,
});

function TarefasPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data, loading, isError, refetch, hasMore, loadingMore, loadMore } = useTasksData(search);
	const { createTask, loading: createLoading } = useCreateTask();
	const [sortMode, setSortMode] = useTaskSortMode();
	const [desktopComposerOpen, setDesktopComposerOpen] = useState(false);
	const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
	const setCollapsed = useTaskGroupsUiStore((state) => state.setCollapsed);
	const setSelectedProjectId = useSelectedProjectStore((state) => state.setSelectedProjectId);
	const selectedProject = data.projects.find((project) => project.id === data.selectedProjectId);
	const searchValue: TriageSearch = {
		q: search.q,
		taskTypeId: search.taskTypeId,
		priorityId: search.priorityId,
		complexity: search.complexity,
		includeCompleted: search.includeCompleted,
	};

	function updateSearch(next: TriageSearch) {
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
	}

	const maintenance = (
		<TaskSyncAction
			projectId={data.selectedProjectId ?? null}
			categories={data.categories}
			priorities={data.priorities}
			features={data.groups}
			triggerClassName="w-full justify-start"
		/>
	);

	return (
		<PageShell
			title="Tarefas"
			description={`${data.pendingCount} pendentes · ${data.executedCount} concluídas`}
			icon={CheckCircle2}
			headerClassName="mb-0"
			contentClassName="max-w-none px-5 pb-0 pt-0 sm:px-6 md:px-0"
		>
			<div className="flex h-full min-h-0 min-w-0 flex-col md:grid md:grid-cols-[300px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)]">
				<TaskTriagePanel
					projectId={data.selectedProjectId ?? null}
					projects={data.projects}
					groups={data.groups}
					tasks={data.tasks}
					categories={data.categories}
					priorities={data.priorities}
					search={searchValue}
					onSearchChange={updateSearch}
					onProjectChange={(projectId) => {
						setSelectedProjectId(projectId);
						navigate({ search: (prev) => ({ ...prev, projectId }), replace: true });
					}}
					sortMode={sortMode}
					onSortModeChange={setSortMode}
					onCollapseAll={() => setCollapsed(collapseAllKeys(data))}
					onExpandAll={() => setCollapsed([])}
					onNewTask={() => setMobileComposerOpen(true)}
					maintenance={maintenance}
				/>

				<div className="min-h-0 min-w-0 flex-1 overflow-y-auto md:bg-background">
					<div className="mx-auto w-full max-w-5xl px-0 pb-8 md:px-7">
						<header className="hidden items-center justify-between gap-4 border-b border-border py-3 md:flex">
							<div className="flex min-w-0 items-baseline gap-2">
								<Title size="lg" className="truncate">
									{selectedProject?.name ?? "Todos os projetos"}
								</Title>
								<Text size="xs" tone="muted" className="shrink-0">
									{data.tasks.length} tarefas · {sortMode}
								</Text>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setDesktopComposerOpen((open) => !open)}
							>
								<Plus className="size-4" />
								Nova tarefa
							</Button>
						</header>

						{desktopComposerOpen && (
							<div className="hidden border-b border-border py-3 md:block">
								<TaskForm
									projectId={data.selectedProjectId}
									onSubmit={createTask}
									loading={createLoading}
								/>
							</div>
						)}

						<div className="pt-4 md:pt-4">
							{isError ? (
								<EmptyFeedback
									icon={WifiOff}
									title="Não foi possível carregar as tarefas"
									subtitle="A fila não reflete o que está salvo. Verifique a conexão com o servidor."
									actionText="Tentar de novo"
									onAction={() => void refetch()}
								/>
							) : data.selectedProjectId === undefined ? (
								<GroupedTaskListByProject
									tasks={data.tasks}
									groups={data.groups}
									projects={data.projects}
									categories={data.categories}
									priorities={data.priorities}
									loading={loading}
									sortMode={sortMode}
									reorderingDisabled={hasMore || sortMode !== "categoria"}
								/>
							) : (
								<GroupedTaskList
									tasks={data.tasks}
									groups={data.groups}
									categories={data.categories}
									priorities={data.priorities}
									loading={loading}
									sortMode={sortMode}
									reorderingDisabled={hasMore || sortMode !== "categoria"}
								/>
							)}
							{!loading && !isError && data.tasks.length === 0 && (
								<EmptyFeedback
									icon={Inbox}
									title="Fila vazia"
									subtitle="Ajuste os filtros ou crie uma tarefa para começar."
									actionText="Nova tarefa"
									onAction={() => setMobileComposerOpen(true)}
								/>
							)}
							{hasMore && (
								<div className="flex justify-center pt-5">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={loadingMore}
										onClick={() => loadMore()}
									>
										{loadingMore && <Loader2 className="animate-spin" />}
										{loadingMore ? "Carregando..." : "Carregar mais tarefas"}
									</Button>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			<Drawer
				open={mobileComposerOpen}
				onClose={() => setMobileComposerOpen(false)}
				side="bottom"
				title="Nova tarefa"
				description={selectedProject?.name ?? "Escolha o projeto"}
			>
				<TaskForm
					projectId={data.selectedProjectId}
					onSubmit={createTask}
					loading={createLoading}
				/>
			</Drawer>
		</PageShell>
	);
}
