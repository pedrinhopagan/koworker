import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/routes/_app/-components/page-shell";
import { ProjectForm, getDefaultProjectColor } from "../-components/project-form";
import { ProjectHeaderActions } from "../-components/project-header-actions";
import { useUpdateProject } from "../-utils/use-update-project";

export const Route = createFileRoute("/_app/projetos/$projetoId/")({
	component: EditarProjetoPage,
});

function EditarProjetoPage() {
	const { projetoId } = Route.useParams();
	const projectQuery = useQuery(orpc.projects.getById.queryOptions({ input: { id: projetoId } }));
	const project = projectQuery.data ?? null;
	const { updateProject, loading, error, success } = useUpdateProject({ projectId: projetoId });
	const formId = "project-edit-form";

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
			actions={
				<ProjectHeaderActions
					mode="edit"
					formId={formId}
					submitLabel="Salvar alterações"
					loading={loading}
					error={error}
					success={success}
					cancelTo="/projetos"
				/>
			}
		>
			<ProjectForm
				mode="edit"
				formId={formId}
				defaultValues={{
					name: project.name,
					description: project.description ?? "",
					color: project.color ?? getDefaultProjectColor(),
					mainRoute: project.mainRoute,
				}}
				onSubmit={updateProject}
			/>
		</PageShell>
	);
}
