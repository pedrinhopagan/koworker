import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/routes/_app/-components/page-shell";
import { ProjectForm } from "./-components/project-form";
import { useCreateProject } from "./-utils/use-create-project";

export const Route = createFileRoute("/_app/projetos/novo/")({
	component: NovoProjetoPage,
});

function NovoProjetoPage() {
	const { createProject, loading, error } = useCreateProject();

	return (
		<PageShell title="Novo Projeto" description="Crie um novo projeto para organizar suas tarefas">
			<div className="mx-auto max-w-xl">
				<ProjectForm onSubmit={createProject} loading={loading} error={error} />
			</div>
		</PageShell>
	);
}
