import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { defaultProjectColor } from "@/constants/colors";
import { ProjectForm } from "../-components/project-form";
import { ProjectHeaderActions } from "../-components/project-header-actions";
import { useUpdateProject } from "../-utils/use-update-project";

export const Route = createFileRoute("/_app/projetos/$projetoId/")({
	component: EditarProjetoPage,
});

function EditarProjetoPage() {
	const { projetoId } = Route.useParams();
	const projectQuery = useQuery(orpc.projects.getById.queryOptions({ input: { id: projetoId } }));
	const project = projectQuery.data ?? null;
	const { updateProject, loading, error } = useUpdateProject({ projectId: projetoId });
	const formId = "project-edit-form";

	const handleRouteChange = () => {
		projectQuery.refetch();
	};

	if (projectQuery.isLoading) {
		return (
			<PageShell
				title="Editar Projeto"
				description="Ajuste as informações do projeto selecionado"
				icon={FolderOpen}
			>
				<Text size="sm" tone="muted">
					Carregando projeto...
				</Text>
			</PageShell>
		);
	}

	if (!project) {
		return (
			<PageShell
				title="Editar Projeto"
				description="Ajuste as informações do projeto selecionado"
				icon={FolderOpen}
			>
				<div className="space-y-3">
					<Text size="sm" tone="muted">
						Projeto não encontrado.
					</Text>
					<Button variant="outline" asChild>
						<Link to="/projetos">Voltar para projetos</Link>
					</Button>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			title="Editar Projeto"
			description="Ajuste as informações do projeto selecionado"
			icon={FolderOpen}
			contentClassName="overflow-y-auto pb-6 md:overflow-hidden md:pb-0"
			actions={
				<ProjectHeaderActions
					mode="edit"
					formId={formId}
					submitLabel="Salvar alterações"
					loading={loading}
					error={error}
					cancelTo="/projetos"
				/>
			}
		>
			<div className="flex min-h-full flex-col gap-8 md:h-full md:min-h-0">
				<ProjectForm
					mode="edit"
					formId={formId}
					defaultValues={{
						name: project.name ?? "",
						description: project.description ?? "",
						color: project.color ?? defaultProjectColor,
						mainRoute: project.mainRoute,
					}}
					onSubmit={updateProject}
					projectId={projetoId}
					routes={project.routes ?? []}
					onRouteChange={handleRouteChange}
				/>
			</div>
		</PageShell>
	);
}
