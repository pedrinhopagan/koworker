import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { z } from "zod";

import { PageShell } from "@/components/layout/page-shell";
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
	const { data, loading } = useProjectsData(projetoId);

	const selectedId = data.selectedProjectId ?? undefined;
	const selectedProject = data.selectedProject ?? undefined;

	return (
		<PageShell
			title="Projetos"
			description="Organize seus projetos e contextos"
			icon={FolderKanban}
			variant="grid"
		>
			<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-4 pb-4">
				<ProjectList projects={data.projects} selectedId={selectedId} loading={loading} />
			</div>

			<section className="min-h-0 min-w-0 h-full overflow-hidden">
				<ProjectSummary project={selectedProject} />
			</section>
		</PageShell>
	);
}
