import { Link, useNavigate } from "@tanstack/react-router";
import { Layers3, Loader2 } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useTaskSortMode } from "@/hooks/use-task-sort-mode";
import { useTaskGroupsUiStore } from "@/stores/task-groups-ui";
import { NO_FEATURE_ROUTE_ID } from "../-utils/task-route-resolution";
import { useTasksData } from "../-utils/use-tasks-data";
import { GroupedTaskList, noGroupKey } from "./grouped-task-list";
import { TaskListControls } from "./task-groups-controls";

type FeatureTaskSearch = {
	q?: string;
	includeCompleted?: boolean;
};

export function FeatureTaskPage({
	featureId,
	projectId,
	search,
	onSearchChange,
}: {
	featureId: string;
	projectId: string;
	search: FeatureTaskSearch;
	onSearchChange: (next: FeatureTaskSearch) => void;
}) {
	const navigate = useNavigate();
	const noFeature = featureId === NO_FEATURE_ROUTE_ID;
	const [sortMode, setSortMode] = useTaskSortMode();
	const setCollapsed = useTaskGroupsUiStore((state) => state.setCollapsed);
	const { data, loading, hasMore, loadingMore, loadMore } = useTasksData({
		projectId,
		groupId: noFeature ? null : featureId,
		...search,
	});
	const feature = noFeature ? null : data.groups.find((group) => group.id === featureId);
	const project = data.projects.find((item) => item.id === projectId);

	if (!loading && (!project || (!noFeature && !feature))) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Feature não encontrada neste projeto.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/tarefas" search={{ projectId }}>
						Voltar para tarefas
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<PageShell
			title={noFeature ? "Sem feature" : feature?.name || "Feature"}
			description={`${data.tasks.length} tarefa${data.tasks.length === 1 ? "" : "s"} em ${project?.name || "projeto"}`}
			icon={Layers3}
			headerClassName="mb-0"
			onBack={() => void navigate({ to: "/tarefas", search: { projectId } })}
		>
			<div className="flex h-full min-h-0 min-w-0 flex-col gap-3 pt-0">
				<TaskListControls
					projectId={projectId}
					search={{ value: search, onChange: onSearchChange }}
					sortMode={sortMode}
					onSortModeChange={setSortMode}
					onCollapseAll={() => setCollapsed([noFeature ? noGroupKey() : featureId])}
					onExpandAll={() => setCollapsed([])}
					allowFeatureCreation={false}
				/>

				<div className="min-h-0 flex-1 overflow-y-auto pb-6 pr-2">
					<GroupedTaskList
						tasks={data.tasks}
						groups={feature ? [feature] : []}
						availableFeatures={data.groups}
						loading={loading}
						sortMode={sortMode}
						reorderingDisabled={hasMore}
					/>
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
		</PageShell>
	);
}
