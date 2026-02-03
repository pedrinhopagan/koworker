import { FolderCog } from "lucide-react";

import { Text, Title } from "@/components/typography";
import { NewRouteForm } from "./-components/new-route-form";
import { RoutesList } from "./-components/routes-list";
import { useProjectRoutes } from "./-utils/use-project-routes";
import type { ProjectRouteItem } from "./-utils/types";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/client";

type ProjectFormRoutesProps = {
	projectId?: string;
	routes?: ProjectRouteItem[];
	onRouteChange?: () => void;
};

export function ProjectFormRoutes({
	projectId,
	routes = [],
	onRouteChange,
}: ProjectFormRoutesProps) {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());

	const onSuccess = () => {
		projectsQuery.refetch();
		if (onRouteChange) {
			onRouteChange();
		}
	};

	const { createRoute, updateRoute, deleteRoute, reorderRoutes, isCreating, isDeleting } =
		useProjectRoutes({
			onSuccess: onSuccess,
		});

	if (!projectId) {
		return (
			<section className="rounded-lg border border-border bg-card/40 p-4">
				<div className="flex items-center gap-3">
					<div className="size-10 rounded-md bg-muted/50 flex items-center justify-center">
						<FolderCog className="size-5 text-muted-foreground" />
					</div>
					<div>
						<Title size="sm">Rotas personalizadas</Title>
						<Text size="sm" tone="muted">
							Salve o projeto primeiro para adicionar rotas
						</Text>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className="rounded-lg border border-border bg-card/40 p-4">
			<div className="flex items-center gap-3">
				<div className="size-10 rounded-md bg-muted/50 flex items-center justify-center">
					<FolderCog className="size-5 text-muted-foreground" />
				</div>
				<div>
					<Title size="sm">Rotas personalizadas</Title>
					<Text size="sm" tone="muted">
						Crie atalhos para abrir terminais em rotas específicas
					</Text>
				</div>
			</div>

			<div className="mt-4 space-y-4">
				<NewRouteForm projectId={projectId} onCreate={createRoute} isCreating={isCreating} />
				<RoutesList
					routes={routes}
					onUpdate={updateRoute}
					onDelete={(id) => deleteRoute({ id })}
					onReorder={(orderedIds) => reorderRoutes({ orderedIds })}
					isDeleting={isDeleting}
				/>
			</div>
		</section>
	);
}
