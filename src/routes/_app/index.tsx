import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboardIcon } from "lucide-react";
import { useMemo } from "react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { useSelectedProjectStore } from "@/stores/selected-project";
import { HomeAgentsSummary, HomeRecentActivity } from "./-components/home-agents-summary";
import { HomeEmptyState } from "./-components/home-empty-state";
import { HomeProjectShowcase } from "./-components/home-project-showcase";

export const Route = createFileRoute("/_app/")({
	component: HomePage,
});

function HomePage() {
	const selectedProjectId = useSelectedProjectStore((s) => s.selectedProjectId);
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const resolvedProjectId = useMemo(() => {
		if (!selectedProjectId) return null;
		return (projectsQuery.data ?? []).some((project) => project.id === selectedProjectId)
			? selectedProjectId
			: null;
	}, [projectsQuery.data, selectedProjectId]);

	const projectQuery = useQuery({
		...orpc.projects.getById.queryOptions({ input: { id: resolvedProjectId ?? "" } }),
		enabled: Boolean(resolvedProjectId),
	});

	const loading = Boolean(selectedProjectId) && (projectsQuery.isLoading || projectQuery.isLoading);
	const project = projectQuery.data;

	return (
		<PageShell
			title="Briefing operacional"
			description={
				project
					? `${project.name} · o que precisa da sua decisão agora`
					: "Escolha o contexto para iniciar o briefing"
			}
			icon={LayoutDashboardIcon}
			contentClassName="overflow-y-auto pb-8"
		>
			{loading && (
				<div className="flex min-h-[28rem] items-center justify-center border border-dashed border-border">
					<Text tone="muted">Preparando o briefing do projeto...</Text>
				</div>
			)}

			{!loading && !project && <HomeEmptyState />}

			{!loading && project && (
				<div className="space-y-7">
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
						<div className="lg:col-span-8">
							<HomeAgentsSummary />
						</div>
						<div className="lg:col-span-4">
							<HomeProjectShowcase project={project} />
						</div>
					</div>
					<HomeRecentActivity />
				</div>
			)}
		</PageShell>
	);
}
