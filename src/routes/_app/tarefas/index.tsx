import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Inbox, Loader2, WifiOff } from "lucide-react";
import { z } from "zod";

import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { EmptyFeedback } from "@/components/ui/empty-feedback";
import { useTaskSortMode } from "@/hooks/use-task-sort-mode";
import { useSelectedProjectStore } from "@/stores/selected-project";
import { useTaskGroupsUiStore } from "@/stores/task-groups-ui";
import {
	GroupedTaskList,
	GroupedTaskListByProject,
	noGroupKey,
} from "./-components/grouped-task-list";
import { TaskSyncAction } from "./-components/task-sync-dialog";
import { TaskTriagePanel, type TriageSearch } from "./-components/task-triage-panel";
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
	includeCompleted: z.coerce.boolean().optional(),
	projetoId: z.string().optional(),
});

// Keep the route search output optional. Returning explicit undefined values in an
// object literal makes TanStack Router infer every filter as a required search key.
const searchSchema = z.object({
	q: z.string().optional(),
	projectId: z.string().optional(),
	includeCompleted: z.boolean().optional(),
});

export const Route = createFileRoute("/_app/tarefas/")({
	validateSearch: (search) => {
		const raw = rawSearchSchema.parse(search);
		return searchSchema.parse({
			q: raw.q,
			projectId: raw.projectId ?? raw.projetoId,
			includeCompleted: raw.includeCompleted,
		});
	},
	component: TarefasPage,
	beforeLoad: ({ search }) => ({ routeProjectId: search.projectId }),
});

function TarefasPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data, loading, isError, refetch, hasMore, loadingMore, loadMore } = useTasksData(search);
	const [sortMode, setSortMode] = useTaskSortMode();
	const setCollapsed = useTaskGroupsUiStore((state) => state.setCollapsed);
	const setSelectedProjectId = useSelectedProjectStore((state) => state.setSelectedProjectId);
	const selectedProject = data.projects.find((project) => project.id === data.selectedProjectId);
	const searchValue: TriageSearch = {
		q: search.q,
		includeCompleted: search.includeCompleted,
	};

	function updateSearch(next: TriageSearch) {
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
	}

	const maintenance = (
		<TaskSyncAction
			projectId={data.selectedProjectId ?? null}
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
					maintenance={maintenance}
				/>

				<div className="min-h-0 min-w-0 flex-1 overflow-y-auto md:bg-background">
					<div className="mx-auto w-full max-w-5xl px-0 pb-8">
						<header className="hidden items-center justify-between gap-4 border-b border-border px-4 py-3 md:flex">
							<div className="flex min-w-0 items-baseline gap-2">
								<Title size="lg" className="truncate">
									{selectedProject?.name ?? "Todos os projetos"}
								</Title>
								<Text size="xs" tone="muted" className="shrink-0">
									{data.tasks.length} tarefas · {sortMode}
								</Text>
							</div>
						</header>

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
									loading={loading}
									sortMode={sortMode}
									reorderingDisabled={hasMore || sortMode !== "manual"}
								/>
							) : (
								<GroupedTaskList
									tasks={data.tasks}
									groups={data.groups}
									loading={loading}
									sortMode={sortMode}
									reorderingDisabled={hasMore || sortMode !== "manual"}
								/>
							)}
							{!loading && !isError && data.tasks.length === 0 && (
								<EmptyFeedback
									icon={Inbox}
									title="Fila vazia"
									subtitle="Ajuste os filtros ou peça a um agente para criar uma tarefa."
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
		</PageShell>
	);
}
