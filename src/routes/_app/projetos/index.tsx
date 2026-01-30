import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PageShell } from "@/routes/_app/-components/page-shell";
import { ProjectList } from "./-components/project-list";
import { ProjectSummary } from "./-components/project-summary";
import { useProjectsData } from "./-utils/use-projects-data";

const searchSchema = z.object({
	q: z.string().optional(),
	status: z.enum(["ativos", "arquivados"]).optional(),
	ordem: z.enum(["recentes", "nome"]).optional(),
	projetoId: z.string().optional(),
});

export const Route = createFileRoute("/_app/projetos/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: ProjetosPage,
});

function ProjetosPage() {
	const { projetoId } = Route.useSearch();
	const { data, loading } = useProjectsData();

	const selectedId = projetoId ?? data.projects[0]?.id;
	const selectedProject = data.projects.find((p) => p.id === selectedId);

	return (
		<PageShell title="Projetos" description="Organize seus projetos e contextos">
			<div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
				<ProjectList projects={data.projects} selectedId={selectedId} loading={loading} />

				<section className="space-y-4">
					<ProjectSummary project={selectedProject} />
				</section>
			</div>
		</PageShell>
	);
}
