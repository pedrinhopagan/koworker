import { createFileRoute } from "@tanstack/react-router";
import { FolderPlus } from "lucide-react";

import { PageShell } from "@/routes/_app/-components/page-shell";
import { getDefaultProjectColor, ProjectForm } from "../-components/project-form";
import { ProjectHeaderActions } from "../-components/project-header-actions";
import { useCreateProject } from "./-utils/use-create-project";

export const Route = createFileRoute("/_app/projetos/novo/")({
	component: NovoProjetoPage,
});

function NovoProjetoPage() {
	const { createProject, loading, error } = useCreateProject();
	const formId = "project-create-form";

	return (
		<PageShell
			title="Novo Projeto"
			description="Crie um novo projeto para organizar suas tarefas"
			icon={FolderPlus}
			actions={
				<ProjectHeaderActions
					mode="create"
					formId={formId}
					submitLabel="Criar projeto"
					loading={loading}
					error={error}
					cancelTo="/projetos"
				/>
			}
		>
			<ProjectForm
				mode="create"
				formId={formId}
				defaultValues={{
					name: "",
					description: "",
					color: getDefaultProjectColor(),
					mainRoute: "",
				}}
				onSubmit={createProject}
			/>
		</PageShell>
	);
}
