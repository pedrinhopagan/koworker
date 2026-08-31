import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import type { ProjectDetail } from "../-utils/use-projects-data";
import { ProjectDocuments } from "./project-documents";
import { ProjectIdentity } from "./project-identity";
import { ProjectLaunchpad } from "./project-launchpad";

type ProjectSummaryProps = {
	project: ProjectDetail | undefined | null;
};

export function ProjectSummary({ project }: ProjectSummaryProps) {
	const queryClient = useQueryClient();

	function invalidateProjects(projectId: string) {
		queryClient.invalidateQueries({ queryKey: orpc.projects.list.queryOptions().queryKey });
		queryClient.invalidateQueries({ queryKey: orpc.projects.overview.queryOptions().queryKey });
		queryClient.invalidateQueries({
			queryKey: orpc.projects.getById.queryOptions({ input: { id: projectId } }).queryKey,
		});
	}

	const updateMutation = useMutation({
		...orpc.projects.update.mutationOptions(),
		onSuccess: (_data, variables) => invalidateProjects(variables.id),
		onError: (error) => toast.error(`Erro ao atualizar projeto: ${error.message}`),
	});
	const reorderRoutesMutation = useMutation({
		...orpc.projectRoutes.reorder.mutationOptions(),
		onSuccess: () => {
			if (project) invalidateProjects(project.id);
		},
		onError: (error) => toast.error(`Erro ao reordenar atalhos: ${error.message}`),
	});

	if (!project) {
		return (
			<div className="flex min-h-56 items-center justify-center border border-dashed border-border bg-card/20 px-6 text-center">
				<div>
					<Title size="sm" as="div">
						Selecione um projeto na prateleira
					</Title>
					<Text size="sm" tone="muted" className="mt-1">
						A bancada será preparada com ações, documentos e resumo.
					</Text>
				</div>
			</div>
		);
	}

	return (
		<div className="min-w-0 border border-border bg-card/20 shadow-xs lg:h-full lg:min-h-0 lg:overflow-y-auto">
			<div className="min-w-0 border-b border-border p-4 sm:p-5">
				<ProjectIdentity
					project={project}
					terminalUpdating={updateMutation.isPending}
					onTerminalChange={(visible) =>
						updateMutation.mutate({ id: project.id, hideTerminal: !visible })
					}
				/>
			</div>
			<div className="grid min-w-0 gap-8 p-4 sm:p-5 lg:grid-cols-2 lg:gap-0 lg:p-0">
				<div className="min-w-0 lg:border-r lg:border-border lg:p-5">
					<ProjectLaunchpad
						key={project.id}
						project={project}
						onReorder={(orderedIds) => reorderRoutesMutation.mutate({ orderedIds })}
					/>
				</div>
				<div className="min-w-0 lg:p-5">
					<ProjectDocuments projectId={project.id} />
				</div>
			</div>
		</div>
	);
}
