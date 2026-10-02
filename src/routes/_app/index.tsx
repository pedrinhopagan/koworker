import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboardIcon } from "lucide-react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { useProjectFocus } from "@/hooks";
import { HomeAgentsSummary } from "./-components/home-agents-summary";
import { HomeEmptyState } from "./-components/home-empty-state";
import { HomeMasthead } from "./-components/home-masthead";
import { HomeRecentTasks } from "./-components/home-recent-tasks";

export const Route = createFileRoute("/_app/")({
	component: HomePage,
});

function HomePage() {
	const { selectedProjectId, loading: projectsLoading } = useProjectFocus();

	const projectQuery = useQuery({
		...orpc.projects.getById.queryOptions({ input: { id: selectedProjectId ?? "" } }),
		enabled: Boolean(selectedProjectId),
	});

	const loading = projectsLoading || (Boolean(selectedProjectId) && projectQuery.isLoading);
	const project = projectQuery.data;

	return (
		<PageShell
			title="Home"
			description="Agentes e últimas tarefas do projeto"
			icon={LayoutDashboardIcon}
			contentClassName="overflow-y-auto pb-8"
		>
			{loading && (
				<div className="flex min-h-[28rem] items-center justify-center border border-dashed border-border">
					<Text tone="muted">Carregando o projeto...</Text>
				</div>
			)}

			{!loading && !project && <HomeEmptyState />}

			{!loading && project && (
				<div className="space-y-8">
					<HomeMasthead project={project} />
					<HomeAgentsSummary projectId={project.id} />
					<HomeRecentTasks projectId={project.id} />
				</div>
			)}
		</PageShell>
	);
}
